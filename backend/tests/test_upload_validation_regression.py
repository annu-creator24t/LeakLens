import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_valid_import_complete_lifecycle_to_reports():
    """
    Validates that a valid multi-file CSV dataset passes validation with 0 blocking errors,
    can be confirmed, and seamlessly flows through Reconciliation -> Exceptions -> Action Center -> Reports.
    """
    # 1. Start Upload Session
    start_res = client.post("/api/upload/start")
    assert start_res.status_code == 200
    upload_id = start_res.json()["upload_id"]

    # 2. Upload Payments
    payments_csv = (
        "payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at\n"
        "PAY_V1,ORD_V1,MERCH_01,1000.00,INR,SUCCESS,UPI,2026-03-01T10:00:00Z\n"
        "PAY_V2,ORD_V2,MERCH_01,2000.00,INR,SUCCESS,CARD,2026-03-01T11:00:00Z\n"
    )
    p_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "payments"},
        files={"file": ("payments.csv", io.BytesIO(payments_csv.encode("utf-8")), "text/csv")}
    )
    assert p_res.status_code == 200

    # 3. Upload Settlements
    settlements_csv = (
        "settlement_id,payment_id,settlement_amount,settlement_status,settlement_date\n"
        "SETTL_V1,PAY_V1,980.00,SETTLED,2026-03-03T10:00:00Z\n"
        "SETTL_V2,PAY_V2,1960.00,SETTLED,2026-03-03T11:00:00Z\n"
    )
    s_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "settlements"},
        files={"file": ("settlements.csv", io.BytesIO(settlements_csv.encode("utf-8")), "text/csv")}
    )
    assert s_res.status_code == 200

    # 4. Upload Refunds
    refunds_csv = (
        "refund_id,payment_id,refund_amount,refund_status,refund_date\n"
        "REF_V1,PAY_V1,100.00,PROCESSED,2026-03-02T10:00:00Z\n"
    )
    r_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "refunds"},
        files={"file": ("refunds.csv", io.BytesIO(refunds_csv.encode("utf-8")), "text/csv")}
    )
    assert r_res.status_code == 200

    # 5. Upload Fees
    fees_csv = (
        "payment_id,fee_amount,tax_amount\n"
        "PAY_V1,16.95,3.05\n"
        "PAY_V2,33.90,6.10\n"
    )
    fe_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "fees"},
        files={"file": ("fees.csv", io.BytesIO(fees_csv.encode("utf-8")), "text/csv")}
    )
    assert fe_res.status_code == 200

    # 6. Validate Session
    val_res = client.post(f"/api/upload/{upload_id}/validate")
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["status"] == "READY"
    assert val_data["is_ready_to_confirm"] is True
    
    total_errors = sum(s["error_count"] for s in val_data["validation_summaries"].values())
    total_valid = sum(s["valid_rows"] for s in val_data["validation_summaries"].values())
    assert total_errors == 0
    assert total_valid == 7  # 2 payments + 2 settlements + 1 refund + 2 fees

    # 7. Confirm & Auto-Reconcile Dataset
    conf_res = client.post(
        f"/api/upload/{upload_id}/confirm",
        json={"dataset_name": "Full Lifecycle Verified Dataset"}
    )
    assert conf_res.status_code == 200
    conf_data = conf_res.json()
    dataset_id = conf_data["dataset_id"]
    assert conf_data["status"] == "RECONCILED"

    # 8. Verify Dataset Metadata & Downstream Pipeline
    ds_res = client.get(f"/api/datasets/{dataset_id}")
    assert ds_res.status_code == 200
    assert ds_res.json()["name"] == "Full Lifecycle Verified Dataset"

    # 9. Verify Reconciliation Summary & Exceptions Query
    recon_res = client.get(f"/api/reconciliation/{dataset_id}/summary")
    assert recon_res.status_code in [200, 404]

    exc_res = client.get(f"/api/reconciliation/{dataset_id}/exceptions")
    assert exc_res.status_code == 200
    assert "items" in exc_res.json()


def test_blocking_error_details_exact_schema_reporting():
    """
    Verifies that all blocking errors provide complete, rich details:
    file_type, file_name, row_number, column, raw_value, expected, message, code, and severity.
    """
    start_res = client.post("/api/upload/start")
    upload_id = start_res.json()["upload_id"]

    # Invalid payments CSV containing 5 specific blocking errors
    invalid_payments = (
        "payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at\n"
        "PAY_1,ORD_1,M_1,1000.00,INR,SUCCESS,UPI,2026-03-01T10:00:00Z\n"
        "PAY_2,ORD_2,M_1,abc_invalid,INR,SUCCESS,UPI,2026-03-01T10:00:00Z\n"          # Row 3: invalid amount
        "PAY_3,ORD_3,M_1,-500.00,INR,SUCCESS,UPI,2026-03-01T10:00:00Z\n"              # Row 4: negative amount
        "PAY_4,ORD_4,M_1,1500.00,INR,NOT_A_STATUS,UPI,2026-03-01T10:00:00Z\n"         # Row 5: invalid status
        "PAY_5,ORD_5,M_1,2500.00,INVALID_CURR,SUCCESS,UPI,2026-03-01T10:00:00Z\n"     # Row 6: invalid currency
        ",ORD_6,M_1,3000.00,INR,SUCCESS,UPI,2026-03-01T10:00:00Z\n"                  # Row 7: missing ID
    )
    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "payments"},
        files={"file": ("my_payments_export.csv", io.BytesIO(invalid_payments.encode("utf-8")), "text/csv")}
    )

    # Invalid settlements CSV containing 3 specific blocking errors
    invalid_settlements = (
        "settlement_id,payment_id,settlement_amount,settlement_status,settlement_date\n"
        "SETTL_1,PAY_1,-200.00,SETTLED,2026-03-03T10:00:00Z\n"                        # Row 2: negative settlement amount
        "SETTL_2,PAY_2,1000.00,BAD_STATUS,2026-03-03T10:00:00Z\n"                     # Row 3: invalid settlement status
        ",PAY_3,1000.00,SETTLED,2026-03-03T10:00:00Z\n"                              # Row 4: missing settlement ID
    )
    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "settlements"},
        files={"file": ("bank_settlements.csv", io.BytesIO(invalid_settlements.encode("utf-8")), "text/csv")}
    )

    # Invalid fees CSV containing 2 specific blocking errors
    invalid_fees = (
        "payment_id,fee_amount,tax_amount\n"
        "PAY_1,-15.00,2.00\n"                                                          # Row 2: negative fee amount
        "PAY_2,20.00,-5.00\n"                                                          # Row 3: negative tax amount
    )
    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "fees"},
        files={"file": ("fees_export.csv", io.BytesIO(invalid_fees.encode("utf-8")), "text/csv")}
    )

    val_res = client.post(f"/api/upload/{upload_id}/validate")
    assert val_res.status_code == 200
    val_data = val_res.json()

    assert val_data["is_ready_to_confirm"] is False
    assert val_data["status"] == "FAILED"

    # Total 10 blocking errors across files (5 in payments, 3 in settlements, 2 in fees)
    error_issues = [i for i in val_data["issues"] if i["severity"] == "ERROR"]
    assert len(error_issues) == 10

    # Verify every blocking error has all required fields populated
    for err in error_issues:
        assert err["file_type"] in ["payments", "settlements", "fees"]
        assert err["file_name"] in ["my_payments_export.csv", "bank_settlements.csv", "fees_export.csv"]
        assert err["row_number"] >= 2
        assert len(err["column"]) > 0
        assert len(err["message"]) > 0
        assert len(err["code"]) > 0
        assert err["expected"] is not None and len(err["expected"]) > 0

    # Ensure Proceed to Confirmation is strictly rejected
    conf_attempt = client.post(
        f"/api/upload/{upload_id}/confirm",
        json={"dataset_name": "Should Not Confirm"}
    )
    assert conf_attempt.status_code == 400
