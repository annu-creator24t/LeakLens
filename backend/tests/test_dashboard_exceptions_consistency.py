import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.generator import GeneratorConfig
from app.services.data_generator import data_generator

client = TestClient(app)


@pytest.mark.asyncio
async def test_dashboard_and_exceptions_mathematical_consistency():
    """
    Regression test: Verifies dashboard reconciliation summary, action-center lifecycle metrics,
    and exceptions page queries for the same active dataset_id are 100% consistent.
    """
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.10,
        seed=777,
        merchant_id="M_CONSISTENCY_TEST",
        anomalies={
            "missing_settlement": True,
            "duplicate_settlement": True,
            "amount_mismatch": True,
            "refund_mismatch": True,
            "fee_anomaly": True,
            "delayed_settlement": True,
            "orphan_settlement": True,
        }
    )
    gen_res, _ = data_generator.generate(cfg)
    dataset_id = gen_res.dataset_id

    # 1. Fetch Reconciliation Summary (Dashboard Hero)
    rec_res = client.get(f"/api/reconciliation/{dataset_id}/summary")
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    recon_exception_count = rec_data["exception_count"]
    assert recon_exception_count > 0, "Generated anomalies must produce exceptions."

    # 2. Fetch Exception Detector Summary
    exc_sum_res = client.get(f"/api/exceptions/{dataset_id}/summary")
    assert exc_sum_res.status_code == 200
    exc_sum_data = exc_sum_res.json()
    assert exc_sum_data["total_exceptions"] == recon_exception_count

    # 3. Fetch Action Center Summary (Dashboard Lifecycle Metrics)
    act_sum_res = client.get(f"/api/action-center/{dataset_id}/summary")
    assert act_sum_res.status_code == 200
    act_sum_data = act_sum_res.json()
    assert act_sum_data["total"] == recon_exception_count
    assert act_sum_data["open"] == recon_exception_count
    assert act_sum_data["investigating"] == 0
    assert act_sum_data["resolved"] == 0
    assert act_sum_data["ignored"] == 0

    # 4. Fetch Priority Queue (Dashboard Priority Table)
    prio_res = client.get(f"/api/action-center/{dataset_id}/priority?limit=100")
    assert prio_res.status_code == 200
    prio_data = prio_res.json()
    assert prio_data["total"] == recon_exception_count
    assert len(prio_data["items"]) > 0

    # 5. Fetch Exceptions Page Records
    exc_list_res = client.get(f"/api/reconciliation/{dataset_id}/exceptions?limit=100")
    assert exc_list_res.status_code == 200
    exc_list_data = exc_list_res.json()
    assert exc_list_data["total"] == recon_exception_count

    # 6. Fetch Exceptions Endpoint Records
    exc_direct_res = client.get(f"/api/exceptions/{dataset_id}?limit=100")
    assert exc_direct_res.status_code == 200
    exc_direct_data = exc_direct_res.json()
    assert exc_direct_data["total"] == recon_exception_count


@pytest.mark.asyncio
async def test_lifecycle_status_transitions_maintain_consistency():
    """
    Regression test: Verifies that transitioning exception status updates open/investigating/resolved
    counts accurately while preserving total detected exceptions count.
    """
    cfg = GeneratorConfig(
        transaction_count=100,
        anomaly_rate=0.08,
        seed=888,
        merchant_id="M_LIFECYCLE_TEST",
        anomalies={
            "missing_settlement": True,
            "duplicate_settlement": True,
            "amount_mismatch": True,
            "refund_mismatch": True,
            "fee_anomaly": True,
            "delayed_settlement": True,
            "orphan_settlement": True,
        }
    )
    gen_res, _ = data_generator.generate(cfg)
    dataset_id = gen_res.dataset_id

    # Initial summary
    act_res_1 = client.get(f"/api/action-center/{dataset_id}/summary")
    assert act_res_1.status_code == 200
    initial_total = act_res_1.json()["total"]
    initial_open = act_res_1.json()["open"]
    assert initial_total > 0
    assert initial_open == initial_total

    # Get one exception to transition
    prio = client.get(f"/api/action-center/{dataset_id}/priority?limit=1").json()
    first_exc = prio["items"][0]
    exc_id = first_exc["exception_id"]

    # Step 1: Start Investigation (OPEN -> INVESTIGATING)
    start_res = client.post(
        f"/api/action-center/{dataset_id}/exceptions/{exc_id}/start",
        json={"note": "Assigned to financial auditor."}
    )
    assert start_res.status_code == 200
    assert start_res.json()["exception"]["status"] == "INVESTIGATING"

    # Verify updated summary
    act_res_2 = client.get(f"/api/action-center/{dataset_id}/summary").json()
    assert act_res_2["total"] == initial_total
    assert act_res_2["open"] == initial_open - 1
    assert act_res_2["investigating"] == 1
    assert act_res_2["resolved"] == 0

    # Step 2: Resolve (INVESTIGATING -> RESOLVED)
    resolve_res = client.post(
        f"/api/action-center/{dataset_id}/exceptions/{exc_id}/resolve",
        json={"note": "Settlement clawback acknowledged."}
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["exception"]["status"] == "RESOLVED"

    # Verify updated summary
    act_res_3 = client.get(f"/api/action-center/{dataset_id}/summary").json()
    assert act_res_3["total"] == initial_total
    assert act_res_3["open"] == initial_open - 1
    assert act_res_3["investigating"] == 0
    assert act_res_3["resolved"] == 1

    # Verify OPEN filter on priority queue excludes resolved
    prio_open = client.get(f"/api/action-center/{dataset_id}/priority?status_filter=OPEN").json()
    assert prio_open["total"] == initial_open - 1

    # Verify ALL filter on priority queue still includes all
    prio_all = client.get(f"/api/action-center/{dataset_id}/priority?status_filter=ALL").json()
    assert prio_all["total"] == initial_total


@pytest.mark.asyncio
async def test_clean_dataset_returns_clean_reconciliation_zero_exceptions():
    """
    Regression test: Verifies that a clean dataset with 0 anomalies produces
    0 exceptions across all endpoints and 100% reconciliation rate.
    """
    cfg = GeneratorConfig(
        transaction_count=50,
        anomaly_rate=0.0,
        seed=999,
        merchant_id="M_CLEAN_TEST",
        anomalies={
            "missing_settlement": False,
            "duplicate_settlement": False,
            "amount_mismatch": False,
            "refund_mismatch": False,
            "fee_anomaly": False,
            "delayed_settlement": False,
            "orphan_settlement": False,
        }
    )
    gen_res, _ = data_generator.generate(cfg)
    dataset_id = gen_res.dataset_id

    # 1. Reconciliation summary
    rec = client.get(f"/api/reconciliation/{dataset_id}/summary").json()
    assert rec["exception_count"] == 0
    assert rec["unexplained_difference"] == 0.0
    assert rec["reconciliation_rate"] == 100.0

    # 2. Action center summary
    act = client.get(f"/api/action-center/{dataset_id}/summary").json()
    assert act["total"] == 0
    assert act["open"] == 0
    assert act["investigating"] == 0
    assert act["resolved"] == 0

    # 3. Exceptions list
    exc_list = client.get(f"/api/reconciliation/{dataset_id}/exceptions").json()
    assert exc_list["total"] == 0
    assert len(exc_list["items"]) == 0
