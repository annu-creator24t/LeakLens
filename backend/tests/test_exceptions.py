import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.generator import GeneratorConfig, AnomalyConfig
from app.services.data_generator import data_generator
from app.services.exception_detector import exception_detector

client = TestClient(app)


# 1. Missing Settlement Detection
@pytest.mark.asyncio
async def test_missing_settlement_rule():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=101,
        anomalies=AnomalyConfig(missing_settlement=True, duplicate_settlement=False, amount_mismatch=False,
                              refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False)
    )
    res, _ = data_generator.generate(cfg)
    det = await exception_detector.detect_exceptions(res.dataset_id)
    assert det.exceptions_detected == 10
    assert det.summary.missing_settlement_count == 10
    assert det.summary.missing_settlement_impact > 0


# 2. Duplicate Settlement Detection
@pytest.mark.asyncio
async def test_duplicate_settlement_rule():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=201,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=True, amount_mismatch=False,
                              refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False)
    )
    res, _ = data_generator.generate(cfg)
    det = await exception_detector.detect_exceptions(res.dataset_id)
    assert det.exceptions_detected == 10
    assert det.summary.duplicate_settlement_count == 10
    assert det.summary.critical_count == 10


# 3. Amount Mismatch Detection
@pytest.mark.asyncio
async def test_amount_mismatch_rule():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=301,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=False, amount_mismatch=True,
                              refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False)
    )
    res, _ = data_generator.generate(cfg)
    det = await exception_detector.detect_exceptions(res.dataset_id)
    assert det.exceptions_detected == 10
    assert det.summary.amount_mismatch_count == 10


# 4. Refund Mismatch Detection
@pytest.mark.asyncio
async def test_refund_mismatch_rule():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=401,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
                              refund_mismatch=True, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False)
    )
    res, _ = data_generator.generate(cfg)
    det = await exception_detector.detect_exceptions(res.dataset_id)
    assert det.exceptions_detected == 10
    assert det.summary.refund_mismatch_count == 10


# 5. Fee Anomaly Detection
@pytest.mark.asyncio
async def test_fee_anomaly_rule():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=501,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
                              refund_mismatch=False, fee_anomaly=True, delayed_settlement=False, orphan_settlement=False)
    )
    res, _ = data_generator.generate(cfg)
    det = await exception_detector.detect_exceptions(res.dataset_id)
    assert det.exceptions_detected == 10
    assert det.summary.fee_anomaly_count == 10


# 6. Delayed Settlement Detection
@pytest.mark.asyncio
async def test_delayed_settlement_rule():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=601,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
                              refund_mismatch=False, fee_anomaly=False, delayed_settlement=True, orphan_settlement=False)
    )
    res, _ = data_generator.generate(cfg)
    det = await exception_detector.detect_exceptions(res.dataset_id)
    assert det.exceptions_detected == 10
    assert det.summary.delayed_settlement_count == 10


# 7. Orphan Settlement Detection
@pytest.mark.asyncio
async def test_orphan_settlement_rule():
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=0.05,
        seed=701,
        anomalies=AnomalyConfig(missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
                              refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=True)
    )
    res, _ = data_generator.generate(cfg)
    det = await exception_detector.detect_exceptions(res.dataset_id)
    assert det.exceptions_detected == 10
    assert det.summary.orphan_settlement_count == 10


# 8. Severity Assignment and Financial Impact
@pytest.mark.asyncio
async def test_severity_and_financial_impact():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.10, seed=801)
    res, _ = data_generator.generate(cfg)
    det = await exception_detector.detect_exceptions(res.dataset_id)
    
    assert det.summary.total_financial_impact > 0
    assert (det.summary.critical_count + det.summary.high_count + det.summary.medium_count + det.summary.low_count) == det.exceptions_detected


# 9. Evidence Generation & Machine-Readability
@pytest.mark.asyncio
async def test_evidence_structure():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.10, seed=901)
    res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(res.dataset_id)
    items, _ = await exception_detector.get_exceptions(res.dataset_id, limit=5)

    for item in items:
        ev = item["evidence"]
        assert "calculation" in ev
        assert "rule" in ev
        assert "expected_settlement" in ev["calculation"]


# 10. Secondary Signals & Precedence
@pytest.mark.asyncio
async def test_secondary_signals_and_precedence():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.10, seed=950)
    res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(res.dataset_id)
    items, _ = await exception_detector.get_exceptions(res.dataset_id, limit=50)

    for item in items:
        assert item["primary_exception_type"] in [
            "ORPHAN_SETTLEMENT", "MISSING_SETTLEMENT", "DUPLICATE_SETTLEMENT",
            "REFUND_MISMATCH", "FEE_ANOMALY", "DELAYED_SETTLEMENT", "AMOUNT_MISMATCH"
        ]
        assert isinstance(item["secondary_signals"], list)


# 11. Idempotency & Clean Replace
@pytest.mark.asyncio
async def test_detection_idempotency():
    cfg = GeneratorConfig(transaction_count=200, anomaly_rate=0.05, seed=999)
    res, _ = data_generator.generate(cfg)

    # Run 1
    run1 = await exception_detector.detect_exceptions(res.dataset_id)
    # Run 2
    run2 = await exception_detector.detect_exceptions(res.dataset_id)

    assert run1.exceptions_detected == run2.exceptions_detected
    assert run1.summary.total_financial_impact == run2.summary.total_financial_impact


# 12. Clean Dataset Produces Exactly ZERO Exceptions
@pytest.mark.asyncio
async def test_clean_dataset_zero_exceptions():
    cfg = GeneratorConfig(transaction_count=1000, anomaly_rate=0.0, seed=777)
    res, _ = data_generator.generate(cfg)
    det = await exception_detector.detect_exceptions(res.dataset_id)

    assert det.exceptions_detected == 0
    assert det.summary.total_exceptions == 0
    assert det.summary.total_financial_impact == 0.0


# 13. REST API Endpoints Test
def test_exceptions_api():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=123)
    res, _ = data_generator.generate(cfg)

    # POST /detect
    post_res = client.post(f"/api/exceptions/detect/{res.dataset_id}")
    assert post_res.status_code == 200
    assert post_res.json()["success"] is True

    # GET /summary
    sum_res = client.get(f"/api/exceptions/{res.dataset_id}/summary")
    assert sum_res.status_code == 200
    assert sum_res.json()["dataset_id"] == res.dataset_id

    # GET / (list)
    list_res = client.get(f"/api/exceptions/{res.dataset_id}")
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) > 0

    # GET /{id} (detail)
    first_id = items[0]["exception_id"]
    det_res = client.get(f"/api/exceptions/{res.dataset_id}/{first_id}")
    assert det_res.status_code == 200
    assert det_res.json()["exception_id"] == first_id
