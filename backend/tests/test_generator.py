import pytest
import time
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.generator import GeneratorConfig, AnomalyConfig
from app.services.data_generator import data_generator

client = TestClient(app)


# 1. Deterministic generation with same seed
def test_deterministic_generation_same_seed():
    cfg1 = GeneratorConfig(transaction_count=200, anomaly_rate=0.05, seed=42)
    cfg2 = GeneratorConfig(transaction_count=200, anomaly_rate=0.05, seed=42)

    res1, meta1 = data_generator.generate(cfg1)
    res2, meta2 = data_generator.generate(cfg2)

    # Cached dataset content should have identical records
    p1 = data_generator._cache[res1.dataset_id]["payments"]
    p2 = data_generator._cache[res2.dataset_id]["payments"]
    assert p1 == p2

    gt1 = data_generator._cache[res1.dataset_id]["ground_truth"]
    gt2 = data_generator._cache[res2.dataset_id]["ground_truth"]
    # Check that anomaly types and amounts match identically
    assert len(gt1) == len(gt2)
    for a, b in zip(gt1, gt2):
        assert a["anomaly_type"] == b["anomaly_type"]
        assert a["expected_amount"] == b["expected_amount"]
        assert a["actual_amount"] == b["actual_amount"]


# 2. Different seed produces different data
def test_different_seed_produces_different_data():
    cfg1 = GeneratorConfig(transaction_count=200, anomaly_rate=0.05, seed=111)
    cfg2 = GeneratorConfig(transaction_count=200, anomaly_rate=0.05, seed=999)

    res1, _ = data_generator.generate(cfg1)
    res2, _ = data_generator.generate(cfg2)

    p1 = data_generator._cache[res1.dataset_id]["payments"]
    p2 = data_generator._cache[res2.dataset_id]["payments"]
    assert p1 != p2


# 3. Minimum transaction count (50)
def test_minimum_transaction_count():
    response = client.post("/api/generator/generate", json={
        "transaction_count": 50,
        "anomaly_rate": 0.05,
        "seed": 101
    })
    assert response.status_code == 200
    data = response.json()
    assert data["transaction_count"] == 50

    # Below min (e.g. 40) should fail validation
    fail_res = client.post("/api/generator/generate", json={
        "transaction_count": 40,
        "anomaly_rate": 0.05,
        "seed": 101
    })
    assert fail_res.status_code == 422


# 4. Maximum transaction count bounds (100,000)
def test_maximum_transaction_count_bounds():
    # Above max (e.g. 100,001) should fail validation
    fail_res = client.post("/api/generator/generate", json={
        "transaction_count": 100001,
        "anomaly_rate": 0.05,
        "seed": 101
    })
    assert fail_res.status_code == 422


# 5. Invalid anomaly rate
def test_invalid_anomaly_rate():
    # Rate > 0.20 or < 0 should fail validation
    fail_res = client.post("/api/generator/generate", json={
        "transaction_count": 1000,
        "anomaly_rate": 0.25,
        "seed": 101
    })
    assert fail_res.status_code == 422


# 6. Clean dataset reconciliation assumptions (CRITICAL QUALITY TEST)
def test_clean_dataset_reconciles_perfectly():
    cfg = GeneratorConfig(transaction_count=500, anomaly_rate=0.0, seed=777)
    res, meta = data_generator.generate(cfg)
    assert res.anomaly_count == 0

    payments = data_generator._cache[res.dataset_id]["payments"]
    settlements = data_generator._cache[res.dataset_id]["settlements"]
    refunds = data_generator._cache[res.dataset_id]["refunds"]
    fees = data_generator._cache[res.dataset_id]["fees"]

    s_map = {s["payment_id"]: s for s in settlements}
    r_map = {r["payment_id"]: r for r in refunds}
    f_map = {f["payment_id"]: f for f in fees}

    for p in payments:
        pid = p["payment_id"]
        if p["payment_status"] == "SUCCESS":
            assert pid in s_map, f"Missing settlement for clean payment {pid}"
            assert pid in f_map, f"Missing fee for clean payment {pid}"

            p_amt = p["amount"]
            r_amt = r_map[pid]["refund_amount"] if pid in r_map else Decimal("0.00")
            f_amt = f_map[pid]["fee_amount"]
            tax_amt = f_map[pid]["tax_amount"]
            s_amt = s_map[pid]["settlement_amount"]

            # Mathematical truth: Expected = Paid - Refund - Fee - Tax
            expected = (p_amt - r_amt - f_amt - tax_amt).quantize(Decimal("0.01"))
            assert s_amt == expected, f"Clean reconciliation mismatch on {pid}: {s_amt} != {expected}"


# 7. Missing Settlement Injection
def test_missing_settlement_injection():
    cfg = GeneratorConfig(
        transaction_count=300,
        anomaly_rate=0.05,
        seed=10,
        anomalies=AnomalyConfig(
            missing_settlement=True, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False
        )
    )
    res, _ = data_generator.generate(cfg)
    gt = data_generator._cache[res.dataset_id]["ground_truth"]
    assert len(gt) == 15
    assert all(a["anomaly_type"] == "MISSING_SETTLEMENT" for a in gt)
    
    # Confirm missing payment_ids actually do NOT exist in settlements
    settlements = data_generator._cache[res.dataset_id]["settlements"]
    settled_pids = {s["payment_id"] for s in settlements}
    for a in gt:
        assert a["payment_id"] not in settled_pids


# 8. Duplicate Settlement Injection
def test_duplicate_settlement_injection():
    cfg = GeneratorConfig(
        transaction_count=300,
        anomaly_rate=0.05,
        seed=20,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=True, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False
        )
    )
    res, _ = data_generator.generate(cfg)
    gt = data_generator._cache[res.dataset_id]["ground_truth"]
    assert len(gt) == 15
    assert all(a["anomaly_type"] == "DUPLICATE_SETTLEMENT" for a in gt)


# 9. Amount Mismatch Injection
def test_amount_mismatch_injection():
    cfg = GeneratorConfig(
        transaction_count=300,
        anomaly_rate=0.05,
        seed=30,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=True,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False
        )
    )
    res, _ = data_generator.generate(cfg)
    gt = data_generator._cache[res.dataset_id]["ground_truth"]
    assert len(gt) == 15
    assert all(a["anomaly_type"] == "AMOUNT_MISMATCH" for a in gt)
    assert all(a["difference"] > Decimal("0.00") for a in gt)


# 10. Refund Mismatch Injection
def test_refund_mismatch_injection():
    cfg = GeneratorConfig(
        transaction_count=300,
        anomaly_rate=0.05,
        seed=40,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=True, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False
        )
    )
    res, _ = data_generator.generate(cfg)
    gt = data_generator._cache[res.dataset_id]["ground_truth"]
    assert len(gt) == 15
    assert all(a["anomaly_type"] == "REFUND_MISMATCH" for a in gt)


# 11. Fee Anomaly Injection
def test_fee_anomaly_injection():
    cfg = GeneratorConfig(
        transaction_count=300,
        anomaly_rate=0.05,
        seed=50,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=True, delayed_settlement=False, orphan_settlement=False
        )
    )
    res, _ = data_generator.generate(cfg)
    gt = data_generator._cache[res.dataset_id]["ground_truth"]
    assert len(gt) == 15
    assert all(a["anomaly_type"] == "FEE_ANOMALY" for a in gt)
    assert all(a["actual_amount"] > a["expected_amount"] for a in gt)


# 12. Delayed Settlement Injection
def test_delayed_settlement_injection():
    cfg = GeneratorConfig(
        transaction_count=300,
        anomaly_rate=0.05,
        seed=60,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=True, orphan_settlement=False
        )
    )
    res, _ = data_generator.generate(cfg)
    gt = data_generator._cache[res.dataset_id]["ground_truth"]
    assert len(gt) == 15
    assert all(a["anomaly_type"] == "DELAYED_SETTLEMENT" for a in gt)


# 13. Orphan Settlement Injection
def test_orphan_settlement_injection():
    cfg = GeneratorConfig(
        transaction_count=300,
        anomaly_rate=0.05,
        seed=70,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=True
        )
    )
    res, _ = data_generator.generate(cfg)
    gt = data_generator._cache[res.dataset_id]["ground_truth"]
    assert len(gt) == 15
    assert all(a["anomaly_type"] == "ORPHAN_SETTLEMENT" for a in gt)

    payments = data_generator._cache[res.dataset_id]["payments"]
    pids = {p["payment_id"] for p in payments}
    for a in gt:
        assert a["payment_id"] not in pids, "Orphan payment_id must not exist in payments dataset"


# 14. Ground-Truth Consistency & Metadata
def test_ground_truth_consistency():
    cfg = GeneratorConfig(transaction_count=1000, anomaly_rate=0.05, seed=80)
    res, meta = data_generator.generate(cfg)
    assert res.anomaly_count == 50
    assert sum(res.anomaly_breakdown.values()) == 50

    # Test metadata endpoint
    meta_res = client.get(f"/api/generator/{res.dataset_id}/metadata")
    assert meta_res.status_code == 200
    meta_json = meta_res.json()
    assert meta_json["transaction_count"] == 1000
    assert meta_json["seed"] == 80


# 15. No Accidental Anomaly Overlap
def test_no_accidental_anomaly_overlap():
    cfg = GeneratorConfig(transaction_count=1000, anomaly_rate=0.07, seed=90)
    res, _ = data_generator.generate(cfg)
    gt = data_generator._cache[res.dataset_id]["ground_truth"]
    
    # Check that payment_ids are unique across non-orphan anomalies
    non_orphan_pids = [a["payment_id"] for a in gt if a["anomaly_type"] != "ORPHAN_SETTLEMENT"]
    assert len(non_orphan_pids) == len(set(non_orphan_pids)), "Detected duplicate payment targets across anomalies!"


# 16. Monetary Precision
def test_monetary_precision_no_float_drift():
    cfg = GeneratorConfig(transaction_count=500, anomaly_rate=0.05, seed=100)
    res, _ = data_generator.generate(cfg)
    
    for coll in ("payments", "settlements", "refunds", "fees"):
        records = data_generator._cache[res.dataset_id][coll]
        for r in records:
            for k, v in r.items():
                if "amount" in k or "fee" in k or "tax" in k:
                    assert isinstance(v, Decimal), f"Field {k} in {coll} is {type(v)}, expected Decimal"


# 17. Large Dataset Generation (10,000 Records Benchmark)
def test_large_dataset_generation_performance():
    cfg = GeneratorConfig(transaction_count=10000, anomaly_rate=0.05, seed=12345)
    
    start = time.perf_counter()
    res, meta = data_generator.generate(cfg)
    elapsed = time.perf_counter() - start

    assert res.success is True
    assert res.transaction_count == 10000
    assert res.anomaly_count == 500
    assert elapsed < 5.0, f"10k generation took {elapsed:.2f}s, expected < 5s"
    print(f"\n10,000 transactions generated in {elapsed:.2f} seconds ({res.generation_time_ms} ms)!")
