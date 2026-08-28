import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.generator import GeneratorConfig
from app.schemas.action_center import InvestigationStatus, AuditAction, BulkActionRequest
from app.services.data_generator import data_generator
from app.services.exception_detector import exception_detector
from app.services.action_center import action_center_service

client = TestClient(app)


# 1. Summary and Priority Queue
@pytest.mark.asyncio
async def test_action_center_summary_and_priority():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=1111)
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)

    # Summary
    summary = await action_center_service.get_summary(gen_res.dataset_id)
    assert summary.total > 0
    assert summary.open == summary.total
    assert summary.investigating == 0
    assert summary.resolved == 0
    assert summary.total_unresolved_impact > 0.0

    # Priority Queue
    items, total = await action_center_service.get_prioritized_exceptions(
        dataset_id=gen_res.dataset_id,
        limit=5
    )
    assert len(items) > 0
    assert total == summary.total
    # Verify CRITICAL / HIGH are at the top
    assert items[0]["severity"] in ["CRITICAL", "HIGH"]


# 2. Complete Workflow: OPEN -> INVESTIGATING -> NOTE -> RESOLVE -> REOPEN
@pytest.mark.asyncio
async def test_full_investigation_lifecycle_workflow():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=2222)
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    first_id = exc_list[0]["exception_id"]

    # Step 1: Start Investigation (OPEN -> INVESTIGATING)
    upd1 = await action_center_service.update_status(
        dataset_id=gen_res.dataset_id,
        exception_id=first_id,
        target_status=InvestigationStatus.INVESTIGATING,
        action=AuditAction.INVESTIGATION_STARTED,
        note="Investigating gateway settlement delay."
    )
    assert upd1["status"] == "INVESTIGATING"

    # Step 2: Add Investigation Note
    note_obj = await action_center_service.add_note(
        dataset_id=gen_res.dataset_id,
        exception_id=first_id,
        note_text="Checked PG settlement batch for capture date."
    )
    assert note_obj.note == "Checked PG settlement batch for capture date."

    # Step 3: Resolve Exception (INVESTIGATING -> RESOLVED)
    upd2 = await action_center_service.update_status(
        dataset_id=gen_res.dataset_id,
        exception_id=first_id,
        target_status=InvestigationStatus.RESOLVED,
        action=AuditAction.RESOLVED,
        note="Provider confirmed settlement will credit in next payout batch."
    )
    assert upd2["status"] == "RESOLVED"

    # Step 4: Reopen Exception (RESOLVED -> OPEN)
    upd3 = await action_center_service.update_status(
        dataset_id=gen_res.dataset_id,
        exception_id=first_id,
        target_status=InvestigationStatus.OPEN,
        action=AuditAction.REOPENED,
        note="Reopening due to subsequent discrepancy."
    )
    assert upd3["status"] == "OPEN"

    # Step 5: Verify History
    hist = await action_center_service.get_history(gen_res.dataset_id, first_id)
    assert hist.current_status == InvestigationStatus.OPEN
    assert len(hist.notes) >= 3
    assert len(hist.audit_events) >= 4


# 3. Invalid Transition Rejection
@pytest.mark.asyncio
async def test_invalid_status_transition():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=3333)
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    first_id = exc_list[0]["exception_id"]

    # Direct OPEN -> RESOLVED is invalid (must be INVESTIGATING first)
    with pytest.raises(ValueError) as excinfo:
        await action_center_service.update_status(
            dataset_id=gen_res.dataset_id,
            exception_id=first_id,
            target_status=InvestigationStatus.RESOLVED,
            action=AuditAction.RESOLVED,
            note="Premature resolution"
        )
    assert "Invalid status transition" in str(excinfo.value)


# 4. Bulk Operations Test
@pytest.mark.asyncio
async def test_bulk_actions():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=4444)
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    target_ids = [e["exception_id"] for e in exc_list[:3]]

    # Bulk START
    bulk_res = await action_center_service.execute_bulk_action(
        dataset_id=gen_res.dataset_id,
        request=BulkActionRequest(
            exception_ids=target_ids,
            action="START",
            note="Bulk investigation initiation"
        )
    )
    assert bulk_res.success is True
    assert bulk_res.updated_count == 3
    assert bulk_res.skipped_count == 0


# 5. REST API Action Center Endpoints Test
def test_action_center_api():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=5555)
    gen_res, _ = data_generator.generate(cfg)
    client.post(f"/api/exceptions/detect/{gen_res.dataset_id}")
    exc_list = client.get(f"/api/exceptions/{gen_res.dataset_id}").json()["items"]
    first_id = exc_list[0]["exception_id"]

    # 1. GET /summary
    s_res = client.get(f"/api/action-center/{gen_res.dataset_id}/summary")
    assert s_res.status_code == 200
    assert s_res.json()["open"] > 0

    # 2. GET /priority
    p_res = client.get(f"/api/action-center/{gen_res.dataset_id}/priority?limit=5")
    assert p_res.status_code == 200
    assert len(p_res.json()["items"]) > 0

    # 3. POST /start
    start_res = client.post(
        f"/api/action-center/{gen_res.dataset_id}/exceptions/{first_id}/start",
        json={"note": "API test investigation start"}
    )
    assert start_res.status_code == 200
    assert start_res.json()["exception"]["status"] == "INVESTIGATING"

    # 4. POST /note
    note_res = client.post(
        f"/api/action-center/{gen_res.dataset_id}/exceptions/{first_id}/note",
        json={"note": "API note text"}
    )
    assert note_res.status_code == 200
    assert note_res.json()["note"]["note"] == "API note text"

    # 5. POST /resolve
    res_res = client.post(
        f"/api/action-center/{gen_res.dataset_id}/exceptions/{first_id}/resolve",
        json={"note": "Resolved via API"}
    )
    assert res_res.status_code == 200
    assert res_res.json()["exception"]["status"] == "RESOLVED"

    # 6. GET /history
    hist_res = client.get(f"/api/action-center/{gen_res.dataset_id}/exceptions/{first_id}/history")
    assert hist_res.status_code == 200
    assert len(hist_res.json()["audit_events"]) >= 2
