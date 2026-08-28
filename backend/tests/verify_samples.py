import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

samples = [
    ("sample_payments.csv", "payments", True, 10, 0),
    ("sample_settlements.csv", "settlements", True, 9, 0),
    ("sample_refunds.csv", "refunds", True, 2, 0),
    ("sample_fees.csv", "fees", True, 9, 0),
    ("sample_invalid_payments.csv", "payments", False, 7, 6),
]

def test_all_sample_files():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sample_dir = os.path.join(base_dir, "data", "sample")

    session_id = None
    for fname, ftype, expected_success, expected_total, expected_min_errors in samples:
        fpath = os.path.join(sample_dir, fname)
        assert os.path.exists(fpath), f"Sample file not found: {fpath}"
        with open(fpath, "rb") as f:
            data = {"dataset_id": session_id} if session_id else {}
            res = client.post(
                f"/api/upload/{ftype}",
                files={"file": (fname, f, "text/csv")},
                data=data
            )
            assert res.status_code == 200
            res_json = res.json()
            assert res_json["success"] == expected_success, f"Failed for {fname}: {res_json}"
            assert res_json["summary"]["total_rows"] == expected_total
            if not expected_success:
                assert len(res_json["errors"]) >= expected_min_errors
            elif not session_id:
                session_id = res_json["dataset_id"]

    # Verify session status
    status_res = client.get(f"/api/upload/status?dataset_id={session_id}")
    assert status_res.status_code == 200
    status_json = status_res.json()
    assert "payments" in status_json["uploaded_files"]
    assert "settlements" in status_json["uploaded_files"]
    assert "refunds" in status_json["uploaded_files"]
    assert "fees" in status_json["uploaded_files"]
    print("All sample files verified successfully!")

if __name__ == "__main__":
    test_all_sample_files()
