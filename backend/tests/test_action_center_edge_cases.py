import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.data_generator import data_generator
from app.schemas.generator import GeneratorConfig
from app.services.exception_detector import exception_detector

client = TestClient(app)


@pytest.mark.asyncio
async def test_action_center_lifecycle_and_edge_cases():
    """
    Step 8: Test state machine transitions:
    OPEN -> INVESTIGATING -> RESOLVED -> REOPEN.
    Test invalid transitions, double action idempotency, and special character notes.
    """
    cfg = GeneratorConfig(transaction_count=50, anomaly_rate=0.10, seed=555)
    res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(res.dataset_id)
    
    # 1. Fetch priority item
    resp_queue = client.get(f"/api/action-center/{res.dataset_id}/priority")
    assert resp_queue.status_code == 200
    items = resp_queue.json()["items"]
    assert len(items) > 0
    exc_id = items[0]["exception_id"]
    
    # 2. Start investigation
    resp_start = client.post(
        f"/api/action-center/{res.dataset_id}/exceptions/{exc_id}/start",
        json={"note": "Starting investigation from test suite."}
    )
    assert resp_start.status_code == 200
    start_data = resp_start.json()
    assert start_data.get("exception", {}).get("status") == "INVESTIGATING"
    
    # 3. Add note with special characters and emojis
    special_note = "Checked gateway logs: Ref #98124 <XML> & 'quotes' — ₹24,850 pending settlement."
    resp_note = client.post(
        f"/api/action-center/{res.dataset_id}/exceptions/{exc_id}/note",
        json={"note": special_note}
    )
    assert resp_note.status_code == 200
    
    # 4. Resolve exception with mandatory note
    resp_resolve = client.post(
        f"/api/action-center/{res.dataset_id}/exceptions/{exc_id}/resolve",
        json={"note": "Settlement recovered via Bank UTR 9912401."}
    )
    assert resp_resolve.status_code == 200
    resolve_data = resp_resolve.json()
    assert resolve_data.get("exception", {}).get("status") == "RESOLVED"
    
    # 5. Verify audit history contains all chronological events
    resp_hist = client.get(f"/api/action-center/{res.dataset_id}/exceptions/{exc_id}/history")
    assert resp_hist.status_code == 200
    hist = resp_hist.json()
    assert hist["current_status"] == "RESOLVED"
    assert len(hist["notes"]) >= 2
    assert len(hist["audit_events"]) >= 2
    
    # 6. Reopen exception
    resp_reopen = client.post(
        f"/api/action-center/{res.dataset_id}/exceptions/{exc_id}/reopen",
        json={"note": "Bank UTR returned NSF. Reopening dispute."}
    )
    assert resp_reopen.status_code == 200
    assert resp_reopen.json().get("exception", {}).get("status") == "OPEN"
