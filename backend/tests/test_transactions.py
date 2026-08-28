import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.generator import GeneratorConfig
from app.services.data_generator import data_generator

client = TestClient(app)


def test_list_datasets_and_transactions_api():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=12345)
    gen_res, _ = data_generator.generate(cfg)

    # 1. GET /api/datasets
    ds_res = client.get("/api/datasets")
    assert ds_res.status_code == 200
    datasets = ds_res.json()["datasets"]
    assert len(datasets) > 0

    # 2. GET /api/transactions/{dataset_id}
    tx_res = client.get(f"/api/transactions/{gen_res.dataset_id}")
    assert tx_res.status_code == 200
    tx_data = tx_res.json()
    assert tx_data["total"] == 100
    assert len(tx_data["items"]) > 0

    first_pid = tx_data["items"][0]["payment_id"]

    # 3. GET /api/transactions/{dataset_id}/{payment_id}
    det_res = client.get(f"/api/transactions/{gen_res.dataset_id}/{first_pid}")
    assert det_res.status_code == 200
    det_json = det_res.json()
    assert det_json["payment"]["payment_id"] == first_pid
    assert "calculation" in det_json
    assert "timeline" in det_json


def test_exception_status_update_api():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=54321)
    gen_res, _ = data_generator.generate(cfg)

    # Detect exceptions first
    client.post(f"/api/exceptions/detect/{gen_res.dataset_id}")
    exc_list = client.get(f"/api/exceptions/{gen_res.dataset_id}").json()["items"]
    assert len(exc_list) > 0
    first_exc_id = exc_list[0]["exception_id"]

    # PATCH status
    patch_res = client.patch(
        f"/api/exceptions/{gen_res.dataset_id}/{first_exc_id}/status",
        json={"status": "INVESTIGATING"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "INVESTIGATING"
