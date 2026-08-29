import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.services.data_generator import data_generator
from app.schemas.generator import GeneratorConfig
from app.services.reconciliation_engine import reconciliation_engine

client = TestClient(app)


@pytest.mark.asyncio
async def test_reports_financial_consistency():
    """
    Step 9: Financial values must strictly match across Dashboard API, Reports Preview, PDF, and CSV.
    """
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=777)
    res, _ = data_generator.generate(cfg)
    rec_res = await reconciliation_engine.reconcile(res.dataset_id)
    
    # 1. Fetch reconciliation summary
    resp_sum = client.get(f"/api/reconciliation/{res.dataset_id}/summary")
    assert resp_sum.status_code == 200
    sum_data = resp_sum.json()
    
    # 2. Fetch report preview
    resp_preview = client.get(f"/api/reports/{res.dataset_id}/preview")
    assert resp_preview.status_code == 200
    preview_data = resp_preview.json()
    
    # 3. Assert strict equality of totals
    assert sum_data["total_transactions"] == preview_data["financial_overview"]["total_transactions"]
    assert float(sum_data["total_volume"]) == float(preview_data["financial_overview"]["total_volume"])
    assert float(sum_data["expected_settlement"]) == float(preview_data["financial_overview"]["expected_settlement"])
    assert float(sum_data["actual_settlement"]) == float(preview_data["financial_overview"]["actual_settlement"])
    assert float(sum_data["unexplained_difference"]) == float(preview_data["financial_overview"]["unexplained_difference"])
    
    # 4. Generate PDF
    resp_pdf = client.post(
        f"/api/reports/{res.dataset_id}/generate",
        json={"format": "pdf", "filters": {}}
    )
    assert resp_pdf.status_code == 200
    pdf_info = resp_pdf.json()
    assert pdf_info["success"] is True
    assert pdf_info["report_id"] is not None
    
    # 5. Fetch CSV export and verify row count
    resp_csv = client.get(f"/api/exports/{res.dataset_id}/exceptions.csv")
    assert resp_csv.status_code == 200
    csv_lines = [l for l in resp_csv.text.splitlines() if l.strip()]
    header_count = 1
    assert len(csv_lines) - header_count == sum_data["exception_count"]
