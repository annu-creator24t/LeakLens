import time
import pytest
from pydantic import ValidationError
from app.services.data_generator import data_generator
from app.services.reconciliation_engine import reconciliation_engine
from app.services.exception_evaluator import exception_evaluator
from app.schemas.generator import GeneratorConfig, AnomalyConfig


@pytest.mark.parametrize("anomaly_rate", [0.0, 0.01, 0.05, 0.10, 0.20])
def test_synthetic_stress_valid_anomaly_rates(anomaly_rate):
    """Test synthetic data generator across valid anomaly rates up to 20%."""
    cfg = GeneratorConfig(
        transaction_count=200,
        anomaly_rate=anomaly_rate,
        seed=12345,
        anomalies=AnomalyConfig(
            missing_settlement=True,
            duplicate_settlement=True,
            amount_mismatch=True,
            refund_mismatch=True,
            fee_anomaly=True,
            delayed_settlement=True,
            orphan_settlement=True,
        )
    )
    res, df_map = data_generator.generate(cfg)
    assert res.dataset_id is not None
    assert res.transaction_count == 200
    if anomaly_rate == 0.0:
        assert res.anomaly_count == 0
    else:
        assert res.anomaly_count > 0


@pytest.mark.parametrize("anomaly_rate", [0.25, 0.50, 1.0])
def test_synthetic_stress_excessive_anomaly_rates_rejected(anomaly_rate):
    """Test that anomaly rates > 20% raise schema validation errors to protect ledger integrity."""
    with pytest.raises(ValidationError):
        GeneratorConfig(
            transaction_count=200,
            anomaly_rate=anomaly_rate,
            seed=12345
        )


@pytest.mark.parametrize("seed", [1, 42, 12345, 999, 123456])
def test_synthetic_stress_multiple_seeds(seed):
    """Test deterministic data generator reproducibility across different seeds."""
    cfg1 = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=seed)
    cfg2 = GeneratorConfig(transaction_count=100, anomaly_rate=0.05, seed=seed)
    
    res1, _ = data_generator.generate(cfg1)
    res2, _ = data_generator.generate(cfg2)
    
    assert res1.anomaly_count == res2.anomaly_count
    assert res1.anomaly_breakdown == res2.anomaly_breakdown


@pytest.mark.asyncio
async def test_official_10k_benchmark_suite():
    """
    Step 3 Official Benchmark:
    10,000 transactions, seed=12345, anomaly_rate=0.05.
    Evaluates detection accuracy (TP, FP, FN, precision, recall, F1, runtime).
    """
    start_time = time.perf_counter()
    
    cfg = GeneratorConfig(
        transaction_count=10000,
        anomaly_rate=0.05,
        seed=12345,
        merchant_id="M_BENCHMARK_10K",
        anomalies=AnomalyConfig(
            missing_settlement=True,
            duplicate_settlement=True,
            amount_mismatch=True,
            refund_mismatch=True,
            fee_anomaly=True,
            delayed_settlement=True,
            orphan_settlement=True,
        )
    )
    gen_res, _ = data_generator.generate(cfg)
    
    # Reconcile & Detect
    rec_res = await reconciliation_engine.reconcile(gen_res.dataset_id)
    
    # Evaluate against ground truth
    eval_res = await exception_evaluator.evaluate(gen_res.dataset_id)
    total_time = (time.perf_counter() - start_time) * 1000
    
    # Assertions
    assert eval_res.total_ground_truth > 0
    assert eval_res.overall.precision >= 0.99
    assert eval_res.overall.recall >= 0.99
    assert eval_res.overall.f1 >= 0.99
    assert total_time < 20000  # Benchmark completes in < 20 seconds
