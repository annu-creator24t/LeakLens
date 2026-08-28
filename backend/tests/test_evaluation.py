import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.generator import GeneratorConfig
from app.services.data_generator import data_generator
from app.services.exception_evaluator import exception_evaluator

client = TestClient(app)


# 1. 100-Record Benchmark Evaluation
@pytest.mark.asyncio
async def test_100_record_evaluation():
    cfg = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=12345)
    res, _ = data_generator.generate(cfg)

    eval_res = await exception_evaluator.evaluate(res.dataset_id)
    assert eval_res.success is True
    assert eval_res.overall.precision >= 0.95
    assert eval_res.overall.recall >= 0.95
    assert eval_res.overall.f1 >= 0.95


# 2. 1,000-Record Benchmark Evaluation
@pytest.mark.asyncio
async def test_1000_record_evaluation():
    cfg = GeneratorConfig(transaction_count=1000, anomaly_rate=0.05, seed=12345)
    res, _ = data_generator.generate(cfg)

    eval_res = await exception_evaluator.evaluate(res.dataset_id)
    assert eval_res.success is True
    assert eval_res.total_ground_truth == 50
    assert eval_res.total_detected == 50
    assert eval_res.overall.precision == 1.0
    assert eval_res.overall.recall == 1.0
    assert eval_res.overall.f1 == 1.0


# 3. 10,000-Record Benchmark Evaluation
@pytest.mark.asyncio
async def test_10000_record_evaluation():
    cfg = GeneratorConfig(transaction_count=10000, anomaly_rate=0.05, seed=12345)
    res, _ = data_generator.generate(cfg)

    start = time.perf_counter()
    eval_res = await exception_evaluator.evaluate(res.dataset_id)
    dur = time.perf_counter() - start

    assert eval_res.success is True
    assert eval_res.total_ground_truth == 500
    assert eval_res.total_detected == 500
    assert eval_res.overall.precision == 1.0
    assert eval_res.overall.recall == 1.0
    assert eval_res.overall.f1 == 1.0
    assert dur < 3.0, f"10k evaluation took {dur:.2f}s, expected < 3s"


# 4. Zero Division & Clean Dataset Handling
@pytest.mark.asyncio
async def test_clean_dataset_evaluation():
    cfg = GeneratorConfig(transaction_count=500, anomaly_rate=0.0, seed=999)
    res, _ = data_generator.generate(cfg)

    eval_res = await exception_evaluator.evaluate(res.dataset_id)
    assert eval_res.success is True
    assert eval_res.total_ground_truth == 0
    assert eval_res.total_detected == 0
    assert eval_res.overall.precision == 1.0
    assert eval_res.overall.recall == 1.0


# 5. REST API Evaluation Endpoint
def test_evaluation_api():
    cfg = GeneratorConfig(transaction_count=200, anomaly_rate=0.05, seed=54321)
    res, _ = data_generator.generate(cfg)

    post_res = client.post(f"/api/evaluation/run/{res.dataset_id}")
    assert post_res.status_code == 200
    json_data = post_res.json()
    assert json_data["success"] is True
    assert "overall" in json_data
    assert "by_type" in json_data
    assert json_data["overall"]["f1"] >= 0.95
