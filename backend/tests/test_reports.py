import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.generator import GeneratorConfig
from app.schemas.reports import ReportFilterParams, ReportGenerateRequest
from app.services.data_generator import data_generator
from app.services.exception_detector import exception_detector
from app.services.reconciliation_engine import reconciliation_engine
from app.services.report_generator import report_generator

client = TestClient(app)


# 1. Report Preview & Financial Consistency
@pytest.mark.asyncio
async def test_report_preview_financial_consistency():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=123)
    gen_res, _ = data_generator.generate(cfg)
    recon_res = await reconciliation_engine.reconcile(gen_res.dataset_id)
    await exception_detector.detect_exceptions(gen_res.dataset_id)

    preview = await report_generator.build_report_data(gen_res.dataset_id)

    # Authority assertions
    assert preview.financial_overview["expected_settlement"] == recon_res.expected_settlement
    assert preview.financial_overview["actual_settlement"] == recon_res.actual_settlement
    assert preview.financial_overview["unexplained_difference"] == recon_res.unexplained_difference
    assert preview.financial_overview["total_transactions"] == recon_res.total_transactions
    assert "LeakLens calculates expected settlement" in preview.methodology


# 2. PDF Generation & Structure
@pytest.mark.asyncio
async def test_pdf_generation():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=456)
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)

    preview = await report_generator.build_report_data(gen_res.dataset_id)
    pdf_bytes = report_generator.generate_pdf(preview, "rep_test_001")

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    # PDF magic number header
    assert pdf_bytes[:4] == b"%PDF"


# 3. CSV Exports Verification
@pytest.mark.asyncio
async def test_csv_exports_structure_and_security():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=789)
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)
    d_id = gen_res.dataset_id

    # 1. Payments CSV
    csv_pay = await report_generator.generate_csv_export(d_id, "payments")
    assert "payment_id,order_id,merchant_id,amount" in csv_pay
    assert "password" not in csv_pay.lower()
    assert "mongodb" not in csv_pay.lower()

    # 2. Settlements CSV
    csv_set = await report_generator.generate_csv_export(d_id, "settlements")
    assert "settlement_id,payment_id,settlement_amount" in csv_set

    # 3. Reconciliation CSV
    csv_rec = await report_generator.generate_csv_export(d_id, "reconciliation")
    assert "expected_settlement" in csv_rec
    assert "actual_settlement" in csv_rec

    # 4. Exceptions CSV
    csv_exc = await report_generator.generate_csv_export(d_id, "exceptions")
    assert "exception_id,payment_id,exception_type" in csv_exc


# 4. REST API Report Endpoints
def test_reports_api_endpoints():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=999)
    gen_res, _ = data_generator.generate(cfg)
    d_id = gen_res.dataset_id
    client.post(f"/api/exceptions/detect/{d_id}")

    # 1. Preview API
    p_res = client.get(f"/api/reports/{d_id}/preview")
    assert p_res.status_code == 200
    assert p_res.json()["financial_overview"]["total_transactions"] == 100

    # 2. Generate PDF API
    g_res = client.post(f"/api/reports/{d_id}/generate", json={"format": "pdf"})
    assert g_res.status_code == 200
    rep_id = g_res.json()["report_id"]
    dl_url = g_res.json()["download_url"]
    assert rep_id is not None
    assert "/download" in dl_url

    # 3. History API
    h_res = client.get(f"/api/reports/{d_id}")
    assert h_res.status_code == 200
    assert len(h_res.json()["reports"]) >= 1

    # 4. Download PDF API
    d_res = client.get(f"/api/reports/{d_id}/{rep_id}/download")
    assert d_res.status_code == 200
    assert d_res.headers["content-type"] == "application/pdf"
    assert d_res.content[:4] == b"%PDF"

    # 5. Download CSV API
    csv_res = client.get(f"/api/exports/{d_id}/exceptions.csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]


# 5. Official 10,000-Record Report Benchmark
@pytest.mark.asyncio
async def test_10k_official_report_benchmark():
    cfg = GeneratorConfig(transaction_count=10000, anomaly_rate=0.05, seed=12345)
    gen_res, _ = data_generator.generate(cfg)
    await exception_detector.detect_exceptions(gen_res.dataset_id)

    preview = await report_generator.build_report_data(gen_res.dataset_id)
    pdf_bytes = report_generator.generate_pdf(preview, "rep_10k_benchmark")

    assert len(pdf_bytes) > 2000
    assert preview.financial_overview["total_transactions"] == 10000
    assert preview.financial_overview["exception_count"] > 0
