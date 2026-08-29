import pytest
from decimal import Decimal
from app.services.dataset_service import dataset_service
from app.services.reconciliation_engine import reconciliation_engine
from app.services.data_generator import data_generator
from app.schemas.generator import GeneratorConfig, AnomalyConfig


@pytest.mark.asyncio
async def test_edge_case_1_perfect_reconciliation():
    """1. Perfect reconciliation: exact matches produce 100% reconciliation rate, 0 exceptions, 0 difference."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [
        {"payment_id": "PAY_01", "order_id": "ORD_01", "merchant_id": "M01", "amount": "1000.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}
    ]
    settlements = [
        {"settlement_id": "SET_01", "payment_id": "PAY_01", "settlement_amount": "978.76", "settlement_status": "SETTLED", "settlement_date": "2026-08-02T12:00:00"}
    ]
    fees = [
        {"payment_id": "PAY_01", "fee_amount": "18.00", "tax_amount": "3.24"}
    ]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.matched_count == 1
    assert res.exception_count == 0
    assert res.unexplained_difference == Decimal("0.00")
    assert res.reconciliation_rate == 100.0


@pytest.mark.asyncio
async def test_edge_case_2_missing_settlement():
    """2. Missing settlement: Payment succeeded but settlement not found."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [{"payment_id": "PAY_MS", "order_id": "ORD_MS", "merchant_id": "M01", "amount": "2500.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}]
    fees = [{"payment_id": "PAY_MS", "fee_amount": "45.00", "tax_amount": "8.10"}]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.exception_count == 1
    assert res.exception_breakdown.get("MISSING_SETTLEMENT") == 1
    assert float(res.unexplained_difference) == 2446.90


@pytest.mark.asyncio
async def test_edge_case_3_duplicate_settlement():
    """3. Duplicate settlement: Multiple bank settlements for a single payment."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [{"payment_id": "PAY_DUP", "order_id": "ORD_DUP", "merchant_id": "M01", "amount": "1000.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}]
    settlements = [
        {"settlement_id": "SET_DUP_1", "payment_id": "PAY_DUP", "settlement_amount": "978.76", "settlement_status": "SETTLED", "settlement_date": "2026-08-02T10:00:00"},
        {"settlement_id": "SET_DUP_2", "payment_id": "PAY_DUP", "settlement_amount": "978.76", "settlement_status": "SETTLED", "settlement_date": "2026-08-02T11:00:00"}
    ]
    fees = [{"payment_id": "PAY_DUP", "fee_amount": "18.00", "tax_amount": "3.24"}]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 2, "invalid_rows": 0, "total_rows": 2})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.exception_count == 1
    assert res.exception_breakdown.get("DUPLICATE_SETTLEMENT") == 1
    assert res.severity_breakdown.get("CRITICAL") == 1


@pytest.mark.asyncio
async def test_edge_case_4_amount_mismatch():
    """4. Amount mismatch: Settlement amount differs from expected."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [{"payment_id": "PAY_MM", "order_id": "ORD_MM", "merchant_id": "M01", "amount": "5000.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}]
    settlements = [{"settlement_id": "SET_MM", "payment_id": "PAY_MM", "settlement_amount": "4000.00", "settlement_status": "SETTLED", "settlement_date": "2026-08-02T10:00:00"}]
    fees = [{"payment_id": "PAY_MM", "fee_amount": "90.00", "tax_amount": "16.20"}]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.exception_count == 1
    assert res.exception_breakdown.get("AMOUNT_MISMATCH") == 1
    assert float(res.unexplained_difference) == 893.80


@pytest.mark.asyncio
async def test_edge_case_5_refund_mismatch():
    """5. Refund mismatch: Settled deduction doesn't equal refund recorded."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [{"payment_id": "PAY_RF", "order_id": "ORD_RF", "merchant_id": "M01", "amount": "10000.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}]
    refunds = [{"refund_id": "REF_01", "payment_id": "PAY_RF", "refund_amount": "3000.00", "refund_status": "PROCESSED", "refund_date": "2026-08-02T10:00:00"}]
    settlements = [{"settlement_id": "SET_RF", "payment_id": "PAY_RF", "settlement_amount": "9787.60", "settlement_status": "SETTLED", "settlement_date": "2026-08-03T10:00:00"}]
    fees = [{"payment_id": "PAY_RF", "fee_amount": "180.00", "tax_amount": "32.40"}]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "refunds", refunds, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.exception_count == 1
    assert res.exception_breakdown.get("REFUND_MISMATCH") == 1


@pytest.mark.asyncio
async def test_edge_case_6_fee_anomaly():
    """6. Fee anomaly: Excess MDR deducted beyond contracted rate."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [{"payment_id": "PAY_FEE", "order_id": "ORD_FEE", "merchant_id": "M01", "amount": "1000.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}]
    settlements = [{"settlement_id": "SET_FEE", "payment_id": "PAY_FEE", "settlement_amount": "940.00", "settlement_status": "SETTLED", "settlement_date": "2026-08-02T10:00:00"}]
    fees = [{"payment_id": "PAY_FEE", "fee_amount": "50.00", "tax_amount": "10.00"}]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.exception_count == 1
    assert res.exception_breakdown.get("UNEXPECTED_FEE") == 1


@pytest.mark.asyncio
async def test_edge_case_7_delayed_settlement():
    """7. Delayed settlement: Settlement occurs > SLA window (3 days)."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [{"payment_id": "PAY_DLY", "order_id": "ORD_DLY", "merchant_id": "M01", "amount": "1000.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}]
    settlements = [{"settlement_id": "SET_DLY", "payment_id": "PAY_DLY", "settlement_amount": "978.76", "settlement_status": "SETTLED", "settlement_date": "2026-08-08T10:00:00"}]
    fees = [{"payment_id": "PAY_DLY", "fee_amount": "18.00", "tax_amount": "3.24"}]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.exception_count == 1
    assert res.exception_breakdown.get("DELAYED_SETTLEMENT") == 1


@pytest.mark.asyncio
async def test_edge_case_8_orphan_settlement():
    """8. Orphan settlement: Settlement credit received without matching payment ID."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    settlements = [{"settlement_id": "SET_ORPHAN", "payment_id": "PAY_NONEXISTENT", "settlement_amount": "1500.00", "settlement_status": "SETTLED", "settlement_date": "2026-08-02T10:00:00"}]
    
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.exception_count == 1
    assert res.exception_breakdown.get("ORPHAN_SETTLEMENT") == 1
    assert res.severity_breakdown.get("CRITICAL") == 1


@pytest.mark.asyncio
async def test_edge_case_9_and_10_zero_and_negative_amounts():
    """9 & 10. Zero and negative amount handling."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [
        {"payment_id": "PAY_ZERO", "order_id": "ORD_Z", "merchant_id": "M01", "amount": "0.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}
    ]
    settlements = [
        {"settlement_id": "SET_ZERO", "payment_id": "PAY_ZERO", "settlement_amount": "0.00", "settlement_status": "SETTLED", "settlement_date": "2026-08-02T10:00:00"}
    ]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.matched_count == 1
    assert res.unexplained_difference == Decimal("0.00")


@pytest.mark.asyncio
async def test_edge_case_11_and_12_tiny_and_huge_amounts():
    """11 & 12. Micro-transactions (0.01) and large-value enterprise transactions (100,000,000.00)."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [
        {"payment_id": "PAY_TINY", "order_id": "ORD_T", "merchant_id": "M01", "amount": "100.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}
    ]
    fees = [
        {"payment_id": "PAY_TINY", "fee_amount": "1.80", "tax_amount": "0.32"}
    ]
    settlements = [
        {"settlement_id": "SET_TINY", "payment_id": "PAY_TINY", "settlement_amount": "97.88", "settlement_status": "SETTLED", "settlement_date": "2026-08-02T10:00:00"}
    ]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.matched_count == 1
    assert res.exception_count == 0
    assert res.unexplained_difference == Decimal("0.00")


@pytest.mark.asyncio
async def test_edge_case_13_and_14_decimal_precision_and_rounding():
    """13 & 14. Decimal precision and rounding verification (no float drift across recurring pennies)."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [
        {"payment_id": "PAY_DEC_0", "order_id": "ORD_0", "merchant_id": "M01", "amount": "1000.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}
    ]
    fees = [
        {"payment_id": "PAY_DEC_0", "fee_amount": "18.00", "tax_amount": "3.24"}
    ]
    settlements = [
        {"settlement_id": "SET_DEC_0", "payment_id": "PAY_DEC_0", "settlement_amount": "978.76", "settlement_status": "SETTLED", "settlement_date": "2026-08-02T10:00:00"}
    ]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.matched_count == 1
    assert res.unexplained_difference == Decimal("0.00")


@pytest.mark.asyncio
async def test_edge_case_15_multiple_partial_refunds():
    """15. Multiple partial refunds summing to a total refund deduction."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [{"payment_id": "PAY_MR", "order_id": "ORD_MR", "merchant_id": "M01", "amount": "1000.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}]
    refunds = [
        {"refund_id": "REF_A", "payment_id": "PAY_MR", "refund_amount": "200.00", "refund_status": "PROCESSED", "refund_date": "2026-08-02T10:00:00"},
        {"refund_id": "REF_B", "payment_id": "PAY_MR", "refund_amount": "300.00", "refund_status": "PROCESSED", "refund_date": "2026-08-02T14:00:00"}
    ]
    fees = [{"payment_id": "PAY_MR", "fee_amount": "18.00", "tax_amount": "3.24"}]
    settlements = [{"settlement_id": "SET_MR", "payment_id": "PAY_MR", "settlement_amount": "478.76", "settlement_status": "SETTLED", "settlement_date": "2026-08-03T10:00:00"}]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "refunds", refunds, {"valid_rows": 2, "invalid_rows": 0, "total_rows": 2})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.matched_count == 1
    assert res.exception_count == 0
    assert res.unexplained_difference == Decimal("0.00")


@pytest.mark.asyncio
async def test_edge_case_21_same_day_settlement():
    """21. Same-day settlement within SLA."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    payments = [{"payment_id": "PAY_SD", "order_id": "ORD_SD", "merchant_id": "M01", "amount": "1000.00", "currency": "INR", "payment_status": "SUCCESS", "created_at": "2026-08-01T10:00:00"}]
    settlements = [{"settlement_id": "SET_SD", "payment_id": "PAY_SD", "settlement_amount": "978.76", "settlement_status": "SETTLED", "settlement_date": "2026-08-01T18:00:00"}]
    fees = [{"payment_id": "PAY_SD", "fee_amount": "18.00", "tax_amount": "3.24"}]
    
    await dataset_service.store_records(ds_id, "payments", payments, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "settlements", settlements, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    await dataset_service.store_records(ds_id, "fees", fees, {"valid_rows": 1, "invalid_rows": 0, "total_rows": 1})
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.matched_count == 1
    assert res.exception_count == 0


@pytest.mark.asyncio
async def test_edge_case_23_empty_dataset():
    """23. Empty dataset session handling without crashes."""
    ds_id = dataset_service.generate_dataset_id()
    await dataset_service.get_or_create_session(ds_id)
    
    res = await reconciliation_engine.reconcile(ds_id)
    assert res.total_transactions == 0
    assert res.matched_count == 0
    assert res.exception_count == 0
    assert res.unexplained_difference == Decimal("0.00")


@pytest.mark.asyncio
async def test_edge_case_24_clean_dataset_zero_anomalies():
    """24. Clean synthetic benchmark dataset produces zero exceptions."""
    cfg = GeneratorConfig(
        transaction_count=500,
        anomaly_rate=0.0,
        seed=42,
        anomalies=AnomalyConfig(
            missing_settlement=False, duplicate_settlement=False, amount_mismatch=False,
            refund_mismatch=False, fee_anomaly=False, delayed_settlement=False, orphan_settlement=False
        )
    )
    res_gen, _ = data_generator.generate(cfg)
    res_rec = await reconciliation_engine.reconcile(res_gen.dataset_id)
    
    assert res_rec.total_transactions == 500
    assert res_rec.exception_count == 0
    assert res_rec.unexplained_difference == Decimal("0.00")
    assert res_rec.reconciliation_rate == 100.0
