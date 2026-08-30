import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.upload_pipeline import upload_pipeline, sanitize_filename

client = TestClient(app)


# 1. Session Initialization
def test_start_upload_session():
    res = client.post("/api/upload/start")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["upload_id"].startswith("upl_")
    assert data["status"] == "UPLOADING"


# 2. File Upload & Schema Auto-Detection
def test_upload_valid_payments_file():
    s_res = client.post("/api/upload/start")
    upload_id = s_res.json()["upload_id"]

    csv_content = (
        "txn_id,merchant_order_id,gross_amount,curr,transaction_status,payment_date\n"
        "PAY_001,ORD_001,1000.00,INR,SUCCESS,2026-08-25T10:00:00Z\n"
        "PAY_002,ORD_002,2500.50,INR,SUCCESS,2026-08-25T11:00:00Z\n"
    )

    f_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "payments"},
        files={"file": ("payments.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    )
    assert f_res.status_code == 200
    data = f_res.json()
    assert data["file_type"] == "payments"
    assert data["row_count"] == 2

    # Verify auto-detected mappings with high confidence
    mappings = {m["source_column"]: m["target_field"] for m in data["column_mappings"]}
    assert mappings["txn_id"] == "payment_id"
    assert mappings["gross_amount"] == "amount"
    assert mappings["transaction_status"] == "payment_status"


# 3. Path Traversal & Filename Sanitization Security Test
def test_path_traversal_sanitization():
    unsafe_name = "../../etc/secret_passwords.env"
    cleaned = sanitize_filename(unsafe_name)
    assert ".." not in cleaned
    assert "/" not in cleaned
    assert "\\" not in cleaned
    assert cleaned == "secret_passwords.env"


# 4. Duplicate ID Detection in Validation
def test_duplicate_payment_id_validation():
    s_res = client.post("/api/upload/start")
    upload_id = s_res.json()["upload_id"]

    csv_content = (
        "payment_id,amount,payment_status\n"
        "PAY_DUP_001,1000.00,SUCCESS\n"
        "PAY_DUP_001,1000.00,SUCCESS\n"
    )

    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "payments"},
        files={"file": ("payments_dup.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    )

    v_res = client.post(f"/api/upload/{upload_id}/validate")
    assert v_res.status_code == 200
    v_data = v_res.json()
    assert v_data["validation_summaries"]["payments"]["error_count"] >= 1
    assert any(i["code"] == "DUPLICATE_PAYMENT_ID" for i in v_data["issues"])
    assert v_data["is_ready_to_confirm"] is False


# 5. Negative Amount Validation
def test_negative_amount_validation():
    s_res = client.post("/api/upload/start")
    upload_id = s_res.json()["upload_id"]

    csv_content = (
        "payment_id,amount,payment_status\n"
        "PAY_NEG_001,-500.00,SUCCESS\n"
    )

    client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "payments"},
        files={"file": ("payments_neg.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    )

    v_res = client.post(f"/api/upload/{upload_id}/validate")
    assert v_res.status_code == 200
    assert any(i["code"] == "NEGATIVE_AMOUNT" for i in v_res.json()["issues"])


# 6. UTF-8 BOM Handling
def test_utf8_bom_file_upload():
    s_res = client.post("/api/upload/start")
    upload_id = s_res.json()["upload_id"]

    csv_content = (
        "payment_id,amount,payment_status\n"
        "PAY_BOM_001,1200.00,SUCCESS\n"
    )
    bom_bytes = b"\xef\xbb\xbf" + csv_content.encode("utf-8")

    f_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "payments"},
        files={"file": ("payments_bom.csv", io.BytesIO(bom_bytes), "text/csv")}
    )
    assert f_res.status_code == 200
    assert f_res.json()["headers"][0] == "payment_id"


# 7. Complete End-to-End Upload & Auto-Reconciliation Flow
def test_end_to_end_upload_pipeline_and_auto_reconciliation():
    # 1. Start session
    s_res = client.post("/api/upload/start")
    upload_id = s_res.json()["upload_id"]

    # 2. Upload Payments (8 success, 1 failed, 1 cancelled)
    with open("data/sample/payments_sample.csv", "rb") as f:
        p_res = client.post(
            f"/api/upload/{upload_id}/file",
            data={"file_type": "payments"},
            files={"file": ("payments_sample.csv", f, "text/csv")}
        )
    assert p_res.status_code == 200

    # 3. Upload Settlements (7 settlements, 1 missing)
    with open("data/sample/settlements_sample.csv", "rb") as f:
        s_res = client.post(
            f"/api/upload/{upload_id}/file",
            data={"file_type": "settlements"},
            files={"file": ("settlements_sample.csv", f, "text/csv")}
        )
    assert s_res.status_code == 200

    # 4. Upload Refunds (1 refund)
    with open("data/sample/refunds_sample.csv", "rb") as f:
        r_res = client.post(
            f"/api/upload/{upload_id}/file",
            data={"file_type": "refunds"},
            files={"file": ("refunds_sample.csv", f, "text/csv")}
        )
    assert r_res.status_code == 200

    # 5. Upload Fees (10 fee records)
    with open("data/sample/fees_sample.csv", "rb") as f:
        fe_res = client.post(
            f"/api/upload/{upload_id}/file",
            data={"file_type": "fees"},
            files={"file": ("fees_sample.csv", f, "text/csv")}
        )
    assert fe_res.status_code == 200

    # 6. Validate Session
    v_res = client.post(f"/api/upload/{upload_id}/validate")
    assert v_res.status_code == 200
    v_data = v_res.json()
    assert v_data["is_ready_to_confirm"] is True
    assert v_data["validation_summaries"]["payments"]["valid_rows"] == 10

    # 7. Confirm & Create Dataset (triggers auto-reconciliation & exception detection)
    c_res = client.post(
        f"/api/upload/{upload_id}/confirm",
        json={"dataset_name": "August Real Merchant Data"}
    )
    assert c_res.status_code == 200
    c_data = c_res.json()
    assert c_data["success"] is True
    assert c_data["dataset_id"].startswith("upload_")
    assert c_data["status"] == "RECONCILED"
    assert c_data["exceptions_detected"] >= 1

    # 8. Verify Dataset Appears in Dataset List
    d_res = client.get("/api/datasets").json()
    datasets = d_res.get("datasets", d_res)
    assert any(d["dataset_id"] == c_data["dataset_id"] for d in datasets)


# 8. Regression Test: Uploaded payments.csv must remain associated through mapping and validation
def test_uploaded_payments_csv_must_remain_associated_through_mapping_and_validation():
    # Test 1: Start fresh session
    s_res = client.post("/api/upload/start")
    assert s_res.status_code == 200
    upload_id = s_res.json()["upload_id"]

    # Test 2: Upload payments.csv with custom uppercase / variations
    payments_csv = (
        "PAYMENT_ID , AMOUNT , STATUS \n"
        "PAY_TEST_001, 1500.00, SUCCESS\n"
        "PAY_TEST_002, 2500.00, SUCCESS\n"
    )
    p_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "payments"},
        files={"file": ("payments.csv", io.BytesIO(payments_csv.encode("utf-8")), "text/csv")}
    )
    assert p_res.status_code == 200
    assert p_res.json()["file_type"] == "payments"
    assert p_res.json()["row_count"] == 2

    # Verify session lookup contains payments
    sess_res = client.get(f"/api/upload/{upload_id}/validation")
    assert sess_res.status_code == 200
    assert "payments" in sess_res.json()["files"]

    # Test 3: Upload settlements.csv
    settlements_csv = (
        "settlement_id,payment_id,settlement_amount,settlement_status,settlement_date\n"
        "SETTL_001,PAY_TEST_001,1467.00,SETTLED,2026-08-25T10:00:00Z\n"
        "SETTL_002,PAY_TEST_002,2450.00,SETTLED,2026-08-25T11:00:00Z\n"
    )
    s_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "settlements"},
        files={"file": ("settlements.csv", io.BytesIO(settlements_csv.encode("utf-8")), "text/csv")}
    )
    assert s_res.status_code == 200

    # Test 4: Upload refunds.csv
    refunds_csv = (
        "refund_id,payment_id,refund_amount,refund_status,refund_date\n"
        "REF_001,PAY_TEST_001,100.00,PROCESSED,2026-08-26T10:00:00Z\n"
    )
    r_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "refunds"},
        files={"file": ("refunds.csv", io.BytesIO(refunds_csv.encode("utf-8")), "text/csv")}
    )
    assert r_res.status_code == 200

    # Test 5: Upload fees.csv
    fees_csv = (
        "payment_id,fee_amount,tax_amount\n"
        "PAY_TEST_001,25.00,4.50\n"
        "PAY_TEST_002,40.00,7.20\n"
    )
    f_res = client.post(
        f"/api/upload/{upload_id}/file",
        data={"file_type": "fees"},
        files={"file": ("fees.csv", io.BytesIO(fees_csv.encode("utf-8")), "text/csv")}
    )
    assert f_res.status_code == 200

    # Test 6: Explicitly update column mappings for Payments
    m_res = client.post(
        f"/api/upload/{upload_id}/mapping",
        json={
            "file_type": "payments",
            "mappings": {
                "PAYMENT_ID": "payment_id",
                "AMOUNT": "amount",
                "STATUS": "payment_status"
            }
        }
    )
    assert m_res.status_code == 200

    # Test 7: Verify all 4 files are present in session before validation
    pre_val = client.get(f"/api/upload/{upload_id}/validation").json()
    assert "payments" in pre_val["files"]
    assert "settlements" in pre_val["files"]
    assert "refunds" in pre_val["files"]
    assert "fees" in pre_val["files"]

    # Test 8: Run Data Validation - must succeed without "Payments file is required" error
    val_res = client.post(f"/api/upload/{upload_id}/validate")
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["status"] == "READY"
    assert val_data["is_ready_to_confirm"] is True
    assert "payments" in val_data["validation_summaries"]
    assert val_data["validation_summaries"]["payments"]["valid_rows"] == 2
    assert val_data["validation_summaries"]["payments"]["error_count"] == 0

    # Test 9: Confirm dataset creation
    conf_res = client.post(
        f"/api/upload/{upload_id}/confirm",
        json={"dataset_name": "Regression Verified Dataset"}
    )
    assert conf_res.status_code == 200
    assert conf_res.json()["success"] is True
    assert conf_res.json()["status"] == "RECONCILED"

