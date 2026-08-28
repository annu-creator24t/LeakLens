import pytest
import time
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.generator import GeneratorConfig, AnomalyConfig
from app.services.data_generator import data_generator
from app.services.reconciliation_engine import reconciliation_engine

client = TestClient(app)


# 1. Clean Dataset Reconciles with 100% Rate and 0 Exceptions
@pytest.mark.asyncio
async def test_clean_reconciliation_zero_exceptions():
    cfg = GeneratorConfig(transaction_count=500, anomaly_rate=0.0, seed=101)
    gen_res, _ = data_generator.generate(cfg)

    rec_res = await reconciliation_engine.reconcile(gen_res.dataset_id)
    assert rec_res.success is True
    assert rec_res.exception_count == 0
    assert rec_res.reconciliation_rate == 100.0
    assert rec_res.unexplained_difference == 0.0


# 2. Missing Settlement Detection
@pytest.mark.asyncio
async def test_missing_settlement_detection():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=201,
        anomalies=AnomalyConfig(
            missing_settlement=True, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False
        )
    )
    gen_res, _ = data_generator.generate(cfg)
    rec_res = await reconciliation_engine.reconcile(gen_res.dataset_id)

    assert rec_res.exception_count == 10
    assert rec_res.exception_breakdown.get("MISSING_SETTLEMENT") == 10


# 3. Duplicate Settlement Detection
@pytest.mark.asyncio
async def test_duplicate_settlement_detection():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=301,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=True, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False
        )
    )
    gen_res, _ = data_generator.generate(cfg)
    rec_res = await reconciliation_engine.reconcile(gen_res.dataset_id)

    assert rec_res.exception_count == 10
    assert rec_res.exception_breakdown.get("DUPLICATE_SETTLEMENT") == 10


# 4. Amount Mismatch Detection
@pytest.mark.asyncio
async def test_amount_mismatch_detection():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=401,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=True,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False
        )
    )
    gen_res, _ = data_generator.generate(cfg)
    rec_res = await reconciliation_engine.reconcile(gen_res.dataset_id)

    assert rec_res.exception_count == 10
    assert rec_res.exception_breakdown.get("AMOUNT_MISMATCH") == 10


# 5. Refund Mismatch Detection
@pytest.mark.asyncio
async def test_refund_mismatch_detection():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=501,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=True, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False
        )
    )
    gen_res, _ = data_generator.generate(cfg)
    rec_res = await reconciliation_engine.reconcile(gen_res.dataset_id)

    assert rec_res.exception_count == 10
    assert rec_res.exception_breakdown.get("REFUND_MISMATCH") == 10


# 6. Fee Anomaly Detection
@pytest.mark.asyncio
async def test_fee_anomaly_detection():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=601,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=True, delayed_settlement=False, orphan_settlement=False
        )
    )
    gen_res, _ = data_generator.generate(cfg)
    rec_res = await reconciliation_engine.reconcile(gen_res.dataset_id)

    assert rec_res.exception_count == 10
    assert rec_res.exception_breakdown.get("UNEXPECTED_FEE") == 10


# 7. Delayed Settlement Detection
@pytest.mark.asyncio
async def test_delayed_settlement_detection():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=701,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=True, orphan_settlement=False
        )
    )
    gen_res, _ = data_generator.generate(cfg)
    rec_res = await reconciliation_engine.reconcile(gen_res.dataset_id)

    assert rec_res.exception_count == 10
    assert rec_res.exception_breakdown.get("DELAYED_SETTLEMENT") == 10


# 8. Orphan Settlement Detection
@pytest.mark.asyncio
async def test_orphan_settlement_detection():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=801,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=True
        )
    )
    gen_res, _ = data_generator.generate(cfg)
    rec_res = await reconciliation_engine.reconcile(gen_res.dataset_id)

    assert rec_res.exception_count == 10
    assert rec_res.exception_breakdown.get("ORPHAN_SETTLEMENT") == 10


# 9. Idempotency Test
@pytest.mark.asyncio
async def test_reconciliation_idempotency():
    cfg = GeneratorConfig(transaction_count=300, anomaly_rate=0.05, seed=901)
    gen_res, _ = data_generator.generate(cfg)

    # Run 1
    run1 = await reconciliation_engine.reconcile(gen_res.dataset_id)
    # Run 2
    run2 = await reconciliation_engine.reconcile(gen_res.dataset_id)

    assert run1.exception_count == run2.exception_count
    assert run1.unexplained_difference == run2.unexplained_difference
    assert run1.matched_count == run2.matched_count

    # Check that database/in-memory list does not have duplicated records
    items, total = await reconciliation_engine.get_exceptions(gen_res.dataset_id, limit=1000)
    assert total == run1.exception_count


# 10. API Endpoints Integration Test
def test_reconciliation_api_endpoints():
    cfg = GeneratorConfig(transaction_count=300, anomaly_rate=0.05, seed=999)
    gen_res, _ = data_generator.generate(cfg)

    # POST /run
    run_res = client.post("/api/reconciliation/run", json={"dataset_id": gen_res.dataset_id})
    assert run_res.status_code == 200
    run_json = run_res.json()
    assert run_json["success"] is True

    # GET /summary
    sum_res = client.get(f"/api/reconciliation/{gen_res.dataset_id}/summary")
    assert sum_res.status_code == 200
    assert sum_res.json()["dataset_id"] == gen_res.dataset_id

    # GET /exceptions
    exc_res = client.get(f"/api/reconciliation/{gen_res.dataset_id}/exceptions")
    assert exc_res.status_code == 200
    exc_json = exc_res.json()
    assert len(exc_json["items"]) > 0

    first_id = exc_json["items"][0]["exception_id"]

    # GET /exceptions/{id}
    detail_res = client.get(f"/api/reconciliation/{gen_res.dataset_id}/exceptions/{first_id}")
    assert detail_res.status_code == 200
    detail_json = detail_res.json()
    assert detail_json["exception_id"] == first_id
    assert len(detail_json["timeline"]) > 0
    assert "evidence" in detail_json


# 11. Large Benchmark Performance Test (10,000 Records)
@pytest.mark.asyncio
async def test_reconciliation_10k_performance():
    cfg = GeneratorConfig(transaction_count=10000, anomaly_rate=0.05, seed=12345)
    gen_res, _ = data_generator.generate(cfg)

    start = time.perf_counter()
    rec_res = await reconciliation_engine.reconcile(gen_res.dataset_id)
    duration = time.perf_counter() - start

    assert rec_res.success is True
    assert rec_res.total_transactions == 10000
    assert rec_res.exception_count == 500
    assert duration < 3.0, f"10k reconciliation took {duration:.2f}s, expected < 3s"
    print(f"\n10,000 transactions reconciled deterministically in {duration:.2f} seconds ({rec_res.duration_ms} ms)!")
