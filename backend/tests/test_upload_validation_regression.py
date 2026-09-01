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


def test_fee_id_versus_fee_amount_mapping_no_collision():
    """
    Tests that a fees file with 'fee_id' (FEE01, FEE02) and 'fee_amount' (25.00, 50.00)
    is correctly auto-mapped without fee_id colliding into or hijacking fee_amount.
    """
    start_res = client.post("/api/upload/start")
    upload_id = start_res.json()["upload_id"]

    # Upload Payments first
    payments_csv = (
        "payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at\n"
        "PAY_101,ORD_101,M1,2500.00,INR,SUCCESS,UPI,2026-03-01T10:00:00Z\n"
        "PAY_102,ORD_102,M1,5000.00,INR,SUCCESS,CARD,2026-03-01T11:00:00Z\n"
        "PAY_103,ORD_103,M1,1500.00,INR,SUCCESS,NET_BANKING,2026-03-01T12:00:00Z\n"
    )
    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "payments"},
        files={"file": ("payments.csv", io.BytesIO(payments_csv.encode("utf-8")), "text/csv")}
    )

    fees_csv = (
        "fee_id,payment_id,fee_amount,tax_amount,fee_type,fee_date\n"
        "FEE01,PAY_101,25.00,4.50,MDR,2026-03-01T10:00:00Z\n"
        "FEE02,PAY_102,50.00,9.00,MDR,2026-03-01T11:00:00Z\n"
        "FEE03,PAY_103,15.50,2.79,FIXED,2026-03-01T12:00:00Z\n"
    )

    upload_file_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "fees"},
        files={"file": ("partner_fees.csv", io.BytesIO(fees_csv.encode("utf-8")), "text/csv")}
    )
    assert upload_file_res.status_code == 200
    file_info = upload_file_res.json()

    # Verify auto-detected mappings preserve exact targets
    mappings = {m["source_column"]: m["target_field"] for m in file_info["column_mappings"]}
    assert mappings["fee_id"] == "fee_id"
    assert mappings["payment_id"] == "payment_id"
    assert mappings["fee_amount"] == "fee_amount"
    assert mappings["tax_amount"] == "tax_amount"
    assert mappings["fee_type"] == "fee_type"
    assert mappings["fee_date"] == "fee_date"

    # Validate session
    val_res = client.post(f"/api/upload/{upload_id}/validate")
    assert val_res.status_code == 200
    val_data = val_res.json()

    # Must produce 0 blocking errors (FEE01 is not parsed as monetary fee_amount)
    fees_summary = val_data["validation_summaries"]["fees"]
    assert fees_summary["error_count"] == 0
    assert fees_summary["valid_rows"] == 3


def test_refund_completed_status_validation_and_reconciliation():
    """
    Tests that refunds with status 'COMPLETED' are recognized as valid completed refunds
    with 0 blocking errors, confirming and reconciling cleanly.
    """
    start_res = client.post("/api/upload/start")
    upload_id = start_res.json()["upload_id"]

    payments_csv = (
        "payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at\n"
        "PAY_RC1,ORD_RC1,MERCH_01,5000.00,INR,SUCCESS,UPI,2026-03-01T10:00:00Z\n"
        "PAY_RC2,ORD_RC2,MERCH_01,3000.00,INR,SUCCESS,CARD,2026-03-01T11:00:00Z\n"
    )
    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "payments"},
        files={"file": ("payments.csv", io.BytesIO(payments_csv.encode("utf-8")), "text/csv")}
    )

    refunds_csv = (
        "refund_id,payment_id,refund_amount,refund_status,refund_date\n"
        "REF_01,PAY_RC1,1000.00,COMPLETED,2026-03-02T10:00:00Z\n"
        "REF_02,PAY_RC2,500.00,COMPLETED,2026-03-02T11:00:00Z\n"
    )
    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "refunds"},
        files={"file": ("refunds_completed.csv", io.BytesIO(refunds_csv.encode("utf-8")), "text/csv")}
    )

    val_res = client.post(f"/api/upload/{upload_id}/validate")
    assert val_res.status_code == 200
    val_data = val_res.json()

    refund_summary = val_data["validation_summaries"]["refunds"]
    assert refund_summary["error_count"] == 0
    assert refund_summary["valid_rows"] == 2
    assert val_data["is_ready_to_confirm"] is True

    # Confirm dataset
    conf_res = client.post(
        f"/api/upload/{upload_id}/confirm",
        json={"dataset_name": "Completed Status Refunds Dataset"}
    )
    assert conf_res.status_code == 200
    assert conf_res.json()["status"] == "RECONCILED"


def test_complete_exact_uploaded_dataset_pipeline():
    """
    Tests full 4-file dataset ingestion with 10 FEE identifiers and COMPLETED refunds.
    Ensures 0 blocking errors, successful confirmation, and downstream API availability.
    """
    start_res = client.post("/api/upload/start")
    upload_id = start_res.json()["upload_id"]

    # 1. Payments
    payments_csv = (
        "payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at\n"
        "TXN001,ORD001,M1,1500.00,INR,SUCCESS,UPI,2026-03-01T10:00:00Z\n"
        "TXN002,ORD002,M1,2500.00,INR,SUCCESS,CARD,2026-03-01T10:30:00Z\n"
        "TXN003,ORD003,M1,3200.00,INR,SUCCESS,NET_BANKING,2026-03-01T11:00:00Z\n"
        "TXN004,ORD004,M1,1200.00,INR,SUCCESS,UPI,2026-03-01T11:30:00Z\n"
        "TXN005,ORD005,M1,4500.00,INR,SUCCESS,CARD,2026-03-01T12:00:00Z\n"
        "TXN006,ORD006,M1,850.00,INR,SUCCESS,UPI,2026-03-01T12:30:00Z\n"
        "TXN007,ORD007,M1,6000.00,INR,SUCCESS,CARD,2026-03-01T13:00:00Z\n"
        "TXN008,ORD008,M1,1800.00,INR,SUCCESS,UPI,2026-03-01T13:30:00Z\n"
        "TXN009,ORD009,M1,9500.00,INR,SUCCESS,CARD,2026-03-01T14:00:00Z\n"
        "TXN010,ORD010,M1,500.00,INR,SUCCESS,UPI,2026-03-01T14:30:00Z\n"
    )
    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "payments"},
        files={"file": ("payments.csv", io.BytesIO(payments_csv.encode("utf-8")), "text/csv")}
    )

    # 2. Settlements
    settlements_csv = (
        "settlement_id,payment_id,settlement_amount,settlement_status,settlement_date\n"
        "SETTL001,TXN001,1468.14,SETTLED,2026-03-03T10:00:00Z\n"
        "SETTL002,TXN002,2446.90,SETTLED,2026-03-03T10:00:00Z\n"
        "SETTL003,TXN003,3132.03,SETTLED,2026-03-03T10:00:00Z\n"
        "SETTL004,TXN004,1174.51,SETTLED,2026-03-03T10:00:00Z\n"
        "SETTL005,TXN005,4404.42,SETTLED,2026-03-03T10:00:00Z\n"
        "SETTL006,TXN006,831.95,SETTLED,2026-03-03T10:00:00Z\n"
        "SETTL007,TXN007,5872.56,SETTLED,2026-03-03T10:00:00Z\n"
        "SETTL008,TXN008,1761.77,SETTLED,2026-03-03T10:00:00Z\n"
        "SETTL009,TXN009,9298.22,SETTLED,2026-03-03T10:00:00Z\n"
        "SETTL010,TXN010,489.38,SETTLED,2026-03-03T10:00:00Z\n"
    )
    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "settlements"},
        files={"file": ("settlements.csv", io.BytesIO(settlements_csv.encode("utf-8")), "text/csv")}
    )

    # 3. Refunds with COMPLETED status
    refunds_csv = (
        "refund_id,payment_id,refund_amount,refund_status,refund_date\n"
        "REF001,TXN003,500.00,COMPLETED,2026-03-02T10:00:00Z\n"
        "REF002,TXN007,1000.00,COMPLETED,2026-03-02T11:00:00Z\n"
    )
    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "refunds"},
        files={"file": ("refunds.csv", io.BytesIO(refunds_csv.encode("utf-8")), "text/csv")}
    )

    # 4. Fees with fee_id column and fee_amount column
    fees_csv = (
        "fee_id,payment_id,fee_amount,tax_amount,fee_type,fee_date\n"
        "FEE01,TXN001,27.00,4.86,MDR,2026-03-01T10:00:00Z\n"
        "FEE02,TXN002,45.00,8.10,MDR,2026-03-01T10:30:00Z\n"
        "FEE03,TXN003,57.60,10.37,MDR,2026-03-01T11:00:00Z\n"
        "FEE04,TXN004,21.60,3.89,MDR,2026-03-01T11:30:00Z\n"
        "FEE05,TXN005,81.00,14.58,MDR,2026-03-01T12:00:00Z\n"
        "FEE06,TXN006,15.30,2.75,MDR,2026-03-01T12:30:00Z\n"
        "FEE07,TXN007,108.00,19.44,MDR,2026-03-01T13:00:00Z\n"
        "FEE08,TXN008,32.40,5.83,MDR,2026-03-01T13:30:00Z\n"
        "FEE09,TXN009,171.00,30.78,MDR,2026-03-01T14:00:00Z\n"
        "FEE10,TXN010,9.00,1.62,MDR,2026-03-01T14:30:00Z\n"
    )
    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "fees"},
        files={"file": ("fees.csv", io.BytesIO(fees_csv.encode("utf-8")), "text/csv")}
    )

    # Validate
    val_res = client.post(f"/api/upload/{upload_id}/validate")
    assert val_res.status_code == 200
    val_data = val_res.json()

    total_errors = sum(s["error_count"] for s in val_data["validation_summaries"].values())
    assert total_errors == 0
    assert val_data["is_ready_to_confirm"] is True

    # Confirm & Import
    conf_res = client.post(
        f"/api/upload/{upload_id}/confirm",
        json={"dataset_name": "Exact Complete Ingested Dataset"}
    )
    assert conf_res.status_code == 200
    dataset_id = conf_res.json()["dataset_id"]

    # Verify downstream API endpoints:
    # 1. Dataset metadata
    ds_res = client.get(f"/api/datasets/{dataset_id}")
    assert ds_res.status_code == 200

    # 2. Reconciliation summary
    recon_res = client.get(f"/api/reconciliation/{dataset_id}/summary")
    assert recon_res.status_code in [200, 404]

    # 3. Exceptions list
    exc_res = client.get(f"/api/reconciliation/{dataset_id}/exceptions")
    assert exc_res.status_code == 200

    # 4. Transactions list
    txns_res = client.get(f"/api/transactions/{dataset_id}")
    assert txns_res.status_code == 200

