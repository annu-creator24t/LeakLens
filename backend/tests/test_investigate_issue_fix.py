import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.data_generator import data_generator
from app.services.exception_detector import exception_detector
from app.services.reconciliation_engine import reconciliation_engine


@pytest.mark.asyncio
async def test_investigate_exception_detail_success():
    """Verify that exception detail returns 200 with complete math & timeline."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Generate fresh dataset
        gen_res = await client.post("/api/generator/generate", json={"size": 100, "anomaly_rate": 0.15})
        assert gen_res.status_code == 200
        dataset_id = gen_res.json()["dataset_id"]

        # 2. Trigger detection
        exc_res = await client.get(f"/api/exceptions/{dataset_id}?limit=50")
        assert exc_res.status_code == 200
        exceptions = exc_res.json()["items"]
        assert len(exceptions) > 0

        # 3. Check every exception in queue: amount fields must be non-null and valid
        for exc in exceptions:
            assert exc.get("amount_discrepancy") is not None
            assert exc.get("expected_settlement") is not None
            assert exc.get("actual_settlement") is not None

            # If it's an AMOUNT_MISMATCH, verify it does not have 0 expected and 0 actual
            exc_type = exc.get("primary_exception_type") or exc.get("exception_type")
            if exc_type == "AMOUNT_MISMATCH":
                exp = float(exc["expected_settlement"])
                act = float(exc["actual_settlement"])
                disc = float(exc["amount_discrepancy"])
                assert disc > 0.0 or exp > 0.0 or act > 0.0

            # 4. Fetch detail via reconciliation endpoint (this was failing with 500)
            detail_res = await client.get(f"/api/reconciliation/{dataset_id}/exceptions/{exc['exception_id']}")
            assert detail_res.status_code == 200
            detail = detail_res.json()
            assert detail["exception_id"] == exc["exception_id"]
            assert len(detail["timeline"]) > 0
            assert "created_at" in detail
            assert "evidence" in detail

            # 5. Fetch detail via exceptions fallback endpoint
            detail_res2 = await client.get(f"/api/exceptions/{dataset_id}/{exc['exception_id']}")
            assert detail_res2.status_code == 200

            # 6. Trigger AI investigation via POST and verify result
            ai_post_res = await client.post(f"/api/ai/investigate/{dataset_id}/{exc['exception_id']}")
            assert ai_post_res.status_code == 200
            ai_data = ai_post_res.json()
            assert ai_data["success"] is True
            assert "investigation" in ai_data
            assert "what_happened" in ai_data["investigation"]

            # Verify GET now returns 200 from cache
            ai_get_res = await client.get(f"/api/ai/investigate/{dataset_id}/{exc['exception_id']}")
            assert ai_get_res.status_code == 200

            # 7. Fetch history endpoint
            hist_res = await client.get(f"/api/action-center/{dataset_id}/exceptions/{exc['exception_id']}/history")
            assert hist_res.status_code == 200
