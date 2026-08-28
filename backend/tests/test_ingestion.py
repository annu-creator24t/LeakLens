import pytest
import io
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.services.csv_parser import csv_parser
from app.services.csv_validator import csv_validator
from app.services.data_normalizer import data_normalizer
from app.services.dataset_service import dataset_service
from app.utils.money import to_decimal

client = TestClient(app)


# 1. Valid Payments CSV
def test_valid_payments_csv():
    content = b"""payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at
PAY_01,ORD_01,MERCH_01,1000.50,INR,SUCCESS,UPI,2026-03-01T10:00:00Z
PAY_02,ORD_02,MERCH_01,2500.00,INR,SUCCESS,CARD,2026-03-01T11:00:00Z
"""
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["summary"]["total_rows"] == 2
    assert data["summary"]["valid_rows"] == 2
    assert data["summary"]["invalid_rows"] == 0
    assert len(data["errors"]) == 0


# 2. Valid Settlements CSV
def test_valid_settlements_csv():
    content = b"""settlement_id,payment_id,settlement_amount,settlement_status,settlement_date
SETTL_01,PAY_01,980.00,SETTLED,2026-03-03T10:00:00Z
SETTL_02,PAY_02,2450.00,SETTLED,2026-03-03T11:00:00Z
"""
    response = client.post(
        "/api/upload/settlements",
        files={"file": ("settlements.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["summary"]["valid_rows"] == 2


# 3. Valid Refunds CSV
def test_valid_refunds_csv():
    content = b"""refund_id,payment_id,refund_amount,refund_status,refund_date
REF_01,PAY_01,200.00,PROCESSED,2026-03-02T10:00:00Z
"""
    response = client.post(
        "/api/upload/refunds",
        files={"file": ("refunds.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["summary"]["valid_rows"] == 1


# 4. Valid Fees CSV
def test_valid_fees_csv():
    content = b"""payment_id,fee_amount,tax_amount
PAY_01,20.00,3.60
PAY_02,50.00,9.00
"""
    response = client.post(
        "/api/upload/fees",
        files={"file": ("fees.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["summary"]["valid_rows"] == 2


# 5. Missing Required Column
def test_missing_required_column():
    # missing 'amount' column
    content = b"""payment_id,order_id,merchant_id,currency,payment_status,payment_method,created_at
PAY_01,ORD_01,MERCH_01,INR,SUCCESS,UPI,2026-03-01T10:00:00Z
"""
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert any(e["code"] == "MISSING_REQUIRED_COLUMNS" for e in data["errors"])


# 6. Unexpected Column
def test_unexpected_column():
    # extra 'unknown_column' present
    content = b"""payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at,unknown_column
PAY_01,ORD_01,MERCH_01,100.00,INR,SUCCESS,UPI,2026-03-01T10:00:00Z,foo
"""
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert any(e["code"] == "UNEXPECTED_COLUMNS" for e in data["errors"])


# 7. Empty CSV
def test_empty_csv():
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(b""), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert any(e["code"] == "MALFORMED_CSV" for e in data["errors"])


# 8. Invalid Amount (Non-numeric)
def test_invalid_amount():
    content = b"""payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at
PAY_01,ORD_01,MERCH_01,not_a_number,INR,SUCCESS,UPI,2026-03-01T10:00:00Z
"""
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert any(e["code"] == "INVALID_AMOUNT" for e in data["errors"])


# 9. Negative Amount
def test_negative_amount():
    content = b"""payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at
PAY_01,ORD_01,MERCH_01,-500.00,INR,SUCCESS,UPI,2026-03-01T10:00:00Z
"""
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert any(e["code"] in ("NEGATIVE_AMOUNT", "NON_POSITIVE_AMOUNT") for e in data["errors"])


# 10. Duplicate Identifier
def test_duplicate_identifier():
    content = b"""payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at
PAY_DUP,ORD_01,MERCH_01,1000.00,INR,SUCCESS,UPI,2026-03-01T10:00:00Z
PAY_DUP,ORD_02,MERCH_01,2000.00,INR,SUCCESS,UPI,2026-03-01T11:00:00Z
"""
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    dup_errors = [e for e in data["errors"] if e["code"] == "DUPLICATE_IDENTIFIER"]
    assert len(dup_errors) == 1
    assert dup_errors[0]["row"] == 3
    assert dup_errors[0]["raw_value"] == "PAY_DUP"


# 11. Invalid Date Format
def test_invalid_date_format():
    content = b"""payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at
PAY_01,ORD_01,MERCH_01,1000.00,INR,SUCCESS,UPI,bad-timestamp-string
"""
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert any(e["code"] == "INVALID_DATE_FORMAT" for e in data["errors"])


# 12. Invalid Status
def test_invalid_status():
    content = b"""payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at
PAY_01,ORD_01,MERCH_01,1000.00,INR,UNRECOGNIZED_STATUS,UPI,2026-03-01T10:00:00Z
"""
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert any(e["code"] == "INVALID_PAYMENT_STATUS" for e in data["errors"])


# 13. Malformed CSV Encoding
def test_malformed_csv():
    # Only whitespace without headers
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(b"   \n  \t  "), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert any(e["code"] == "MALFORMED_CSV" for e in data["errors"])


# 14. Normalization Service
def test_normalization_rules():
    raw_payment = {
        "payment_id": " PAY_TRIM ",
        "order_id": "ORD_TRIM",
        "merchant_id": "MERCH_01",
        "amount": " 9,999.50 ",
        "currency": " inr ",
        "payment_status": " success ",
        "payment_method": " upi ",
        "created_at": " 2026-03-01 10:30:00 ",
    }
    normalized = data_normalizer.normalize_payment(raw_payment)
    assert normalized["payment_id"] == "PAY_TRIM"
    assert normalized["amount"] == Decimal("9999.50")
    assert normalized["currency"] == "INR"
    assert normalized["payment_status"] == "SUCCESS"
    assert normalized["payment_method"] == "UPI"
    assert normalized["created_at"] == "2026-03-01T10:30:00Z"


# 15. Dataset Isolation
@pytest.mark.asyncio
async def test_dataset_isolation():
    # Create two different dataset sessions
    s1 = await dataset_service.get_or_create_session("ds_alpha")
    s2 = await dataset_service.get_or_create_session("ds_beta")

    rec1 = [{"payment_id": "P_ALPHA", "order_id": "O1", "merchant_id": "M1", "amount": Decimal("100.00"), "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-03-01T10:00:00Z"}]
    rec2 = [{"payment_id": "P_BETA", "order_id": "O2", "merchant_id": "M2", "amount": Decimal("200.00"), "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-03-01T10:00:00Z"}]

    await dataset_service.store_records("ds_alpha", "payments", rec1, {"valid_rows": 1})
    await dataset_service.store_records("ds_beta", "payments", rec2, {"valid_rows": 1})

    alpha_records = await dataset_service.get_records("ds_alpha", "payments")
    beta_records = await dataset_service.get_records("ds_beta", "payments")

    assert len(alpha_records) == 1
    assert alpha_records[0]["payment_id"] == "P_ALPHA"
    assert alpha_records[0]["dataset_id"] == "ds_alpha"

    assert len(beta_records) == 1
    assert beta_records[0]["payment_id"] == "P_BETA"
    assert beta_records[0]["dataset_id"] == "ds_beta"
