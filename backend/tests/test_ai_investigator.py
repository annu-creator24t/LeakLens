import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.generator import GeneratorConfig, AnomalyConfig
from app.services.data_generator import data_generator
from app.services.exception_detector import exception_detector
from app.services.ai_investigator import ai_investigator
from app.services.ai_base import MockAIService, get_ai_service

client = TestClient(app)


# 1. Missing Settlement Investigation
@pytest.mark.asyncio
async def test_missing_settlement_ai_investigation():
    cfg = GeneratorConfig(
        transaction_count=100,
        anomaly_rate=0.05,
        seed=101,
        anomalies=AnomalyConfig(missing_settlement=True, duplicate_settlement=False, amount_mismatch=False,
                              refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False)
    )
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    
    first_exc = exc_list[0]
    inv_res = await ai_investigator.investigate_exception(gen_res.dataset_id, first_exc["exception_id"])

    assert inv_res.success is True
    assert "settlement" in inv_res.investigation.what_happened.lower() or "settlement" in inv_res.investigation.summary.lower()
    assert len(inv_res.investigation.possible_causes) > 0
    assert len(inv_res.investigation.recommended_actions) > 0
    assert inv_res.investigation.confidence >= 0.90
    assert len(inv_res.investigation.evidence_points) > 0


# 2. Duplicate Settlement Investigation
@pytest.mark.asyncio
async def test_duplicate_settlement_ai_investigation():
    cfg = GeneratorConfig(
        transaction_count=100,
        anomaly_rate=0.05,
        seed=201,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=True, amount_mismatch=False,
                              refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False)
    )
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    
    first_exc = exc_list[0]
    inv_res = await ai_investigator.investigate_exception(gen_res.dataset_id, first_exc["exception_id"])

    assert inv_res.success is True
    assert "duplicate" in inv_res.investigation.summary.lower() or "excess" in inv_res.investigation.summary.lower()


# 3. Amount Mismatch Investigation
@pytest.mark.asyncio
async def test_amount_mismatch_ai_investigation():
    cfg = GeneratorConfig(
        transaction_count=100,
        anomaly_rate=0.05,
        seed=301,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=False, amount_mismatch=True,
                              refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False)
    )
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    
    first_exc = exc_list[0]
    inv_res = await ai_investigator.investigate_exception(gen_res.dataset_id, first_exc["exception_id"])

    assert inv_res.success is True
    assert "deviates" in inv_res.investigation.summary.lower() or "differs" in inv_res.investigation.summary.lower() or "variance" in inv_res.investigation.summary.lower()


# 4. Refund Mismatch Investigation
@pytest.mark.asyncio
async def test_refund_mismatch_ai_investigation():
    cfg = GeneratorConfig(
        transaction_count=100,
        anomaly_rate=0.05,
        seed=401,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
                              refund_mismatch=True, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False)
    )
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    
    first_exc = exc_list[0]
    inv_res = await ai_investigator.investigate_exception(gen_res.dataset_id, first_exc["exception_id"])

    assert inv_res.success is True
    assert "refund" in inv_res.investigation.summary.lower()


# 5. Fee Anomaly Investigation
@pytest.mark.asyncio
async def test_fee_anomaly_ai_investigation():
    cfg = GeneratorConfig(
        transaction_count=100,
        anomaly_rate=0.05,
        seed=501,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
                              refund_mismatch=False, fee_anomaly=True, delayed_settlement=False, orphan_settlement=False)
    )
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    
    first_exc = exc_list[0]
    inv_res = await ai_investigator.investigate_exception(gen_res.dataset_id, first_exc["exception_id"])

    assert inv_res.success is True
    assert "fee" in inv_res.investigation.summary.lower()


# 6. Delayed Settlement Investigation
@pytest.mark.asyncio
async def test_delayed_settlement_ai_investigation():
    cfg = GeneratorConfig(
        transaction_count=100,
        anomaly_rate=0.05,
        seed=601,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
                              refund_mismatch=False, fee_anomaly=False, delayed_settlement=True, orphan_settlement=False)
    )
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    
    first_exc = exc_list[0]
    inv_res = await ai_investigator.investigate_exception(gen_res.dataset_id, first_exc["exception_id"])

    assert inv_res.success is True
    assert "sla" in inv_res.investigation.summary.lower() or "delayed" in inv_res.investigation.summary.lower() or "days" in inv_res.investigation.summary.lower()


# 7. Orphan Settlement Investigation
@pytest.mark.asyncio
async def test_orphan_settlement_ai_investigation():
    cfg = GeneratorConfig(
        transaction_count=100,
        anomaly_rate=0.05,
        seed=701,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
                              refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=True)
    )
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    
    first_exc = exc_list[0]
    inv_res = await ai_investigator.investigate_exception(gen_res.dataset_id, first_exc["exception_id"])

    assert inv_res.success is True
    assert "unknown" in inv_res.investigation.summary.lower() or "orphan" in inv_res.investigation.summary.lower() or "not found" in inv_res.investigation.summary.lower()


# 8. Evidence Hash & Cache Reuse Verification
@pytest.mark.asyncio
async def test_ai_investigation_cache_reuse():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=888)
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    exc_list, _ = await exception_detector.get_exceptions(gen_res.dataset_id)
    first_exc_id = exc_list[0]["exception_id"]

    # Call 1 -> generated
    call1 = await ai_investigator.investigate_exception(gen_res.dataset_id, first_exc_id)
    assert call1.cached is False

    # Call 2 -> should return cached result
    call2 = await ai_investigator.investigate_exception(gen_res.dataset_id, first_exc_id)
    assert call2.cached is True
    assert call2.metadata["investigation_id"] == call1.metadata["investigation_id"]
    assert call2.metadata["evidence_hash"] == call1.metadata["evidence_hash"]

    # Call 3 -> with force_refresh = True -> regenerates
    call3 = await ai_investigator.investigate_exception(gen_res.dataset_id, first_exc_id, force_refresh=True)
    assert call3.cached is False


# 9. Anti-Hallucination & Financial Truth Grounding Test
@pytest.mark.asyncio
async def test_ai_hallucination_prevention():
    mock = MockAIService()
    
    # Missing settlement evidence where settlements is empty list
    evidence = {
        "payment": {"payment_id": "PAY999", "amount": "5000.00", "status": "SUCCESS"},
        "settlements": [],
        "refunds": [],
        "calculation": {"expected_settlement": "4890.00", "actual_settlement": "0.00", "difference": "4890.00"},
        "details": {}
    }
    
    res = await mock.investigate(evidence, "MISSING_SETTLEMENT", "CRITICAL")
    
    # Assert AI does not hallucinate settlement received or refund
    assert "no corresponding settlement" in res.what_happened.lower() or "0 corresponding settlement" in res.what_happened.lower()
    assert "₹4890.00" in res.summary or "₹4890.00" in res.why_it_matters or "₹4890.00" in res.what_happened or "5000.00" in res.summary


# 10. REST API Investigation Endpoints Test
def test_ai_investigation_api():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=999)
    gen_res, _ = data_generator.generate(cfg)
    client.post(f"/api/exceptions/detect/{gen_res.dataset_id}")
    exc_list = client.get(f"/api/exceptions/{gen_res.dataset_id}").json()["items"]
    first_exc_id = exc_list[0]["exception_id"]

    # POST /api/ai/investigate/{dataset_id}/{exception_id}
    post_res = client.post(f"/api/ai/investigate/{gen_res.dataset_id}/{first_exc_id}")
    assert post_res.status_code == 200
    json_data = post_res.json()
    assert json_data["success"] is True
    assert "investigation" in json_data
    assert "metadata" in json_data
    assert json_data["metadata"]["prompt_version"] == "v1.0"

    # GET /api/ai/investigate/{dataset_id}/{exception_id}
    get_res = client.get(f"/api/ai/investigate/{gen_res.dataset_id}/{first_exc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["cached"] is True
