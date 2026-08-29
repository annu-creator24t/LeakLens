import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_upload_empty_csv():
    """Upload empty file must be rejected gracefully with success: False, not 500."""
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(b""), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert any(e["code"] in ["EMPTY_FILE", "MALFORMED_CSV"] for e in data["errors"])


def test_upload_header_only_csv():
    """Upload header-only CSV with 0 data rows."""
    content = b"payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at\n"
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    assert response.json()["summary"]["valid_rows"] == 0


def test_upload_malformed_csv_syntax():
    """Upload corrupted CSV bytes with unmatched quotes/null bytes."""
    content = b"payment_id,amount\nPAY_01,\"unclosed quote\nPAY_02,500.00"
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    assert response.status_code != 500


def test_upload_binary_renamed_csv():
    """Upload compiled binary executable bytes renamed to .csv."""
    content = b"\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00>\x00"
    response = client.post(
        "/api/upload/payments",
        files={"file": ("malicious.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False


def test_upload_missing_required_columns():
    """Upload CSV missing critical payment_id column."""
    content = b"order_id,amount,currency\nORD_01,500.00,INR\n"
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert any(e["code"] == "MISSING_REQUIRED_COLUMNS" for e in data["errors"])


def test_upload_duplicate_identifiers():
    """Upload CSV with duplicate payment_ids."""
    content = (
        b"payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at\n"
        b"PAY_DUP_1,ORD_01,M01,500.00,INR,SUCCESS,UPI,2026-08-01T10:00:00Z\n"
        b"PAY_DUP_1,ORD_02,M01,600.00,INR,SUCCESS,UPI,2026-08-01T10:05:00Z\n"
    )
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["invalid_rows"] >= 1


def test_upload_invalid_date_format():
    """Upload CSV with invalid date strings."""
    content = (
        b"payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at\n"
        b"PAY_DATE,ORD_01,M01,500.00,INR,SUCCESS,UPI,invalid-date-string\n"
    )
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["invalid_rows"] >= 1


def test_upload_unicode_and_special_chars():
    """Upload CSV containing unicode merchant names and emojis."""
    content = (
        b"payment_id,order_id,merchant_id,amount,currency,payment_status,payment_method,created_at\n"
        b"PAY_UNI,ORD_\xe2\x9c\xa8,M_\xe0\xa4\xad\xe0\xa4\xbe\xe0\xa4\xb0\xe0\xa4\xa4,1250.00,INR,SUCCESS,UPI,2026-08-01T10:00:00Z\n"
    )
    response = client.post(
        "/api/upload/payments",
        files={"file": ("payments.csv", io.BytesIO(content), "text/csv")}
    )
    assert response.status_code == 200
    assert response.status_code != 500
