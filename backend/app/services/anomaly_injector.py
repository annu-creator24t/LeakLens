import random
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Tuple, Optional
from app.utils.money import to_decimal
from app.schemas.generator import AnomalyConfig


class AnomalyInjectorService:
    def inject_anomalies(
        self,
        rng: random.Random,
        dataset_id: str,
        payments: List[Dict[str, Any]],
        settlements: List[Dict[str, Any]],
        refunds: List[Dict[str, Any]],
        fees: List[Dict[str, Any]],
        config: AnomalyConfig,
        total_anomaly_target: int
    ) -> Tuple[
        List[Dict[str, Any]],  # modified payments
        List[Dict[str, Any]],  # modified settlements
        List[Dict[str, Any]],  # modified refunds
        List[Dict[str, Any]],  # modified fees
        List[Dict[str, Any]],  # ground truth entries
        Dict[str, int]         # anomaly breakdown counts
    ]:
        """
        Injects controlled financial discrepancies into clean datasets.
        Guarantees isolated (non-overlapping) targets across anomaly categories.
        """
        ground_truth: List[Dict[str, Any]] = []
        breakdown: Dict[str, int] = {
            "MISSING_SETTLEMENT": 0,
            "DUPLICATE_SETTLEMENT": 0,
            "AMOUNT_MISMATCH": 0,
            "REFUND_MISMATCH": 0,
            "FEE_ANOMALY": 0,
            "DELAYED_SETTLEMENT": 0,
            "ORPHAN_SETTLEMENT": 0,
        }

        if total_anomaly_target <= 0:
            return payments, settlements, refunds, fees, ground_truth, breakdown

        # Determine enabled anomaly types
        enabled_types: List[str] = []
        if config.missing_settlement:
            enabled_types.append("MISSING_SETTLEMENT")
        if config.duplicate_settlement:
            enabled_types.append("DUPLICATE_SETTLEMENT")
        if config.amount_mismatch:
            enabled_types.append("AMOUNT_MISMATCH")
        if config.refund_mismatch:
            enabled_types.append("REFUND_MISMATCH")
        if config.fee_anomaly:
            enabled_types.append("FEE_ANOMALY")
        if config.delayed_settlement:
            enabled_types.append("DELAYED_SETTLEMENT")
        if config.orphan_settlement:
            enabled_types.append("ORPHAN_SETTLEMENT")

        if not enabled_types:
            return payments, settlements, refunds, fees, ground_truth, breakdown

        # Calculate per-type quotas evenly distributed
        base_quota = total_anomaly_target // len(enabled_types)
        remainder = total_anomaly_target % len(enabled_types)
        quotas: Dict[str, int] = {t: base_quota for t in enabled_types}
        for i in range(remainder):
            quotas[enabled_types[i]] += 1

        # Index clean records for rapid, isolated lookup
        # Only SUCCESS payments with normal settlements participate
        settlement_by_payment: Dict[str, Dict[str, Any]] = {s["payment_id"]: s for s in settlements}
        refund_by_payment: Dict[str, Dict[str, Any]] = {r["payment_id"]: r for r in refunds}
        fee_by_payment: Dict[str, Dict[str, Any]] = {f["payment_id"]: f for f in fees}

        successful_payment_ids = [
            p["payment_id"] for p in payments 
            if p["payment_status"] == "SUCCESS" and p["payment_id"] in settlement_by_payment
        ]
        
        # Shuffle deterministically to draw disjoint pools
        shuffled_pids = list(successful_payment_ids)
        rng.shuffle(shuffled_pids)

        assigned_pointer = 0
        anomaly_counter = 1

        # Working collections
        out_payments = list(payments)
        out_settlements = list(settlements)
        out_refunds = list(refunds)
        out_fees = list(fees)

        # Map for in-place modifications
        settlement_idx_map = {s["payment_id"]: i for i, s in enumerate(out_settlements)}
        fee_idx_map = {f["payment_id"]: i for i, f in enumerate(out_fees)}

        # Helper to claim a slice of clean payments without overlap
        def claim_payments(count: int, require_refund: bool = False, forbid_refund: bool = False) -> List[str]:
            nonlocal assigned_pointer
            claimed = []
            while assigned_pointer < len(shuffled_pids) and len(claimed) < count:
                pid = shuffled_pids[assigned_pointer]
                assigned_pointer += 1
                has_refund = pid in refund_by_payment
                if require_refund and not has_refund:
                    continue
                if forbid_refund and has_refund:
                    continue
                claimed.append(pid)
            return claimed

        # 1. MISSING_SETTLEMENT
        if "MISSING_SETTLEMENT" in quotas and quotas["MISSING_SETTLEMENT"] > 0:
            target_pids = claim_payments(quotas["MISSING_SETTLEMENT"])
            pids_to_remove = set(target_pids)
            
            # Remove from settlements list
            out_settlements = [s for s in out_settlements if s["payment_id"] not in pids_to_remove]
            # Refresh index map
            settlement_idx_map = {s["payment_id"]: i for i, s in enumerate(out_settlements)}

            for pid in target_pids:
                orig_s = settlement_by_payment[pid]
                ground_truth.append({
                    "anomaly_id": f"AN_{anomaly_counter:04d}",
                    "dataset_id": dataset_id,
                    "anomaly_type": "MISSING_SETTLEMENT",
                    "payment_id": pid,
                    "settlement_id": orig_s["settlement_id"],
                    "refund_id": "",
                    "expected_amount": orig_s["settlement_amount"],
                    "actual_amount": Decimal("0.00"),
                    "difference": orig_s["settlement_amount"],
                    "severity": "CRITICAL",
                    "description": "Successful payment has no settlement record."
                })
                breakdown["MISSING_SETTLEMENT"] += 1
                anomaly_counter += 1

        # 2. DUPLICATE_SETTLEMENT
        if "DUPLICATE_SETTLEMENT" in quotas and quotas["DUPLICATE_SETTLEMENT"] > 0:
            target_pids = claim_payments(quotas["DUPLICATE_SETTLEMENT"])
            for pid in target_pids:
                orig_s = settlement_by_payment[pid]
                dup_s_id = f"SETTL_DUP_{rng.randint(10000, 99999)}"
                # Add duplicate settlement
                dup_doc = dict(orig_s)
                dup_doc["settlement_id"] = dup_s_id
                out_settlements.append(dup_doc)

                ground_truth.append({
                    "anomaly_id": f"AN_{anomaly_counter:04d}",
                    "dataset_id": dataset_id,
                    "anomaly_type": "DUPLICATE_SETTLEMENT",
                    "payment_id": pid,
                    "settlement_id": dup_s_id,
                    "refund_id": "",
                    "expected_amount": orig_s["settlement_amount"],
                    "actual_amount": orig_s["settlement_amount"] * Decimal("2"),
                    "difference": orig_s["settlement_amount"],
                    "severity": "CRITICAL",
                    "description": f"Duplicate settlement payout generated under {dup_s_id}."
                })
                breakdown["DUPLICATE_SETTLEMENT"] += 1
                anomaly_counter += 1

        # 3. AMOUNT_MISMATCH
        if "AMOUNT_MISMATCH" in quotas and quotas["AMOUNT_MISMATCH"] > 0:
            target_pids = claim_payments(quotas["AMOUNT_MISMATCH"])
            for pid in target_pids:
                if pid not in settlement_idx_map:
                    continue
                s_idx = settlement_idx_map[pid]
                orig_amount = out_settlements[s_idx]["settlement_amount"]
                
                # Deduct between 5% and 25% or add discrepancy
                delta = (orig_amount * to_decimal(rng.choice(["0.08", "0.12", "0.15", "0.20"]))).quantize(Decimal("0.01"))
                if delta == Decimal("0.00"):
                    delta = Decimal("50.00")
                
                new_amount = (orig_amount - delta).quantize(Decimal("0.01"))
                if new_amount <= Decimal("0.00"):
                    new_amount = (orig_amount + Decimal("100.00")).quantize(Decimal("0.01"))
                    delta = Decimal("100.00")

                out_settlements[s_idx]["settlement_amount"] = new_amount

                ground_truth.append({
                    "anomaly_id": f"AN_{anomaly_counter:04d}",
                    "dataset_id": dataset_id,
                    "anomaly_type": "AMOUNT_MISMATCH",
                    "payment_id": pid,
                    "settlement_id": out_settlements[s_idx]["settlement_id"],
                    "refund_id": "",
                    "expected_amount": orig_amount,
                    "actual_amount": new_amount,
                    "difference": delta,
                    "severity": "HIGH",
                    "description": f"Actual settlement (₹{new_amount}) deviates from expected (₹{orig_amount})."
                })
                breakdown["AMOUNT_MISMATCH"] += 1
                anomaly_counter += 1

        # 4. REFUND_MISMATCH
        if "REFUND_MISMATCH" in quotas and quotas["REFUND_MISMATCH"] > 0:
            # Prefer payments with refunds
            target_pids = claim_payments(quotas["REFUND_MISMATCH"], require_refund=False)
            for pid in target_pids:
                if pid not in settlement_idx_map:
                    continue
                s_idx = settlement_idx_map[pid]
                orig_s_amount = out_settlements[s_idx]["settlement_amount"]
                
                # Check if refund already exists or create one
                ref = refund_by_payment.get(pid)
                if ref:
                    # Case A: A refund happened, but settlement was NOT reduced (remains full gross without refund deduction)
                    ref_amount = ref["refund_amount"]
                    corrupted_s_amount = (orig_s_amount + ref_amount).quantize(Decimal("0.01"))
                    out_settlements[s_idx]["settlement_amount"] = corrupted_s_amount
                    
                    ground_truth.append({
                        "anomaly_id": f"AN_{anomaly_counter:04d}",
                        "dataset_id": dataset_id,
                        "anomaly_type": "REFUND_MISMATCH",
                        "payment_id": pid,
                        "settlement_id": out_settlements[s_idx]["settlement_id"],
                        "refund_id": ref["refund_id"],
                        "expected_amount": orig_s_amount,
                        "actual_amount": corrupted_s_amount,
                        "difference": ref_amount,
                        "severity": "HIGH",
                        "description": "Refund processed but settlement was not deducted accordingly."
                    })
                else:
                    # Case B: Inject a new refund record but do not reflect it in settlement
                    new_ref_id = f"REF_MIS_{rng.randint(10000, 99999)}"
                    # 50% partial refund
                    p_doc = next(p for p in payments if p["payment_id"] == pid)
                    ref_amount = (p_doc["amount"] * Decimal("0.5")).quantize(Decimal("0.01"))
                    
                    out_refunds.append({
                        "refund_id": new_ref_id,
                        "payment_id": pid,
                        "refund_amount": ref_amount,
                        "refund_status": "PROCESSED",
                        "refund_date": p_doc["created_at"],
                    })

                    ground_truth.append({
                        "anomaly_id": f"AN_{anomaly_counter:04d}",
                        "dataset_id": dataset_id,
                        "anomaly_type": "REFUND_MISMATCH",
                        "payment_id": pid,
                        "settlement_id": out_settlements[s_idx]["settlement_id"],
                        "refund_id": new_ref_id,
                        "expected_amount": (orig_s_amount - ref_amount).quantize(Decimal("0.01")),
                        "actual_amount": orig_s_amount,
                        "difference": ref_amount,
                        "severity": "HIGH",
                        "description": "Refund record exists but settlement does not reflect deduction."
                    })
                breakdown["REFUND_MISMATCH"] += 1
                anomaly_counter += 1

        # 5. FEE_ANOMALY
        if "FEE_ANOMALY" in quotas and quotas["FEE_ANOMALY"] > 0:
            target_pids = claim_payments(quotas["FEE_ANOMALY"])
            for pid in target_pids:
                if pid not in fee_idx_map:
                    continue
                f_idx = fee_idx_map[pid]
                orig_fee = out_fees[f_idx]["fee_amount"]
                
                # Inflate fee by 3x - 5x
                inflated_fee = (orig_fee * to_decimal(rng.choice(["3.5", "4.0", "5.0"])) + Decimal("150.00")).quantize(Decimal("0.01"))
                fee_diff = (inflated_fee - orig_fee).quantize(Decimal("0.01"))
                out_fees[f_idx]["fee_amount"] = inflated_fee

                ground_truth.append({
                    "anomaly_id": f"AN_{anomaly_counter:04d}",
                    "dataset_id": dataset_id,
                    "anomaly_type": "FEE_ANOMALY",
                    "payment_id": pid,
                    "settlement_id": "",
                    "refund_id": "",
                    "expected_amount": orig_fee,
                    "actual_amount": inflated_fee,
                    "difference": fee_diff,
                    "severity": "MEDIUM",
                    "description": f"Actual fee (₹{inflated_fee}) significantly exceeds standard contractual rate (₹{orig_fee})."
                })
                breakdown["FEE_ANOMALY"] += 1
                anomaly_counter += 1

        # 6. DELAYED_SETTLEMENT
        if "DELAYED_SETTLEMENT" in quotas and quotas["DELAYED_SETTLEMENT"] > 0:
            target_pids = claim_payments(quotas["DELAYED_SETTLEMENT"])
            for pid in target_pids:
                if pid not in settlement_idx_map:
                    continue
                s_idx = settlement_idx_map[pid]
                orig_date_str = out_settlements[s_idx]["settlement_date"]
                orig_dt = datetime.strptime(orig_date_str, "%Y-%m-%dT%H:%M:%SZ")
                
                # Delay by +10 to +20 days
                delayed_dt = orig_dt + timedelta(days=rng.randint(10, 20))
                delayed_date_str = delayed_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                out_settlements[s_idx]["settlement_date"] = delayed_date_str

                ground_truth.append({
                    "anomaly_id": f"AN_{anomaly_counter:04d}",
                    "dataset_id": dataset_id,
                    "anomaly_type": "DELAYED_SETTLEMENT",
                    "payment_id": pid,
                    "settlement_id": out_settlements[s_idx]["settlement_id"],
                    "refund_id": "",
                    "expected_amount": out_settlements[s_idx]["settlement_amount"],
                    "actual_amount": out_settlements[s_idx]["settlement_amount"],
                    "difference": Decimal("0.00"),
                    "severity": "MEDIUM",
                    "description": f"Settlement delayed beyond SLA window (Expected: {orig_date_str}, Actual: {delayed_date_str})."
                })
                breakdown["DELAYED_SETTLEMENT"] += 1
                anomaly_counter += 1

        # 7. ORPHAN_SETTLEMENT
        if "ORPHAN_SETTLEMENT" in quotas and quotas["ORPHAN_SETTLEMENT"] > 0:
            for _ in range(quotas["ORPHAN_SETTLEMENT"]):
                orphan_pid = f"PAY_GHOST_{rng.randint(100000, 999999)}"
                orphan_sid = f"SETTL_ORPHAN_{rng.randint(10000, 99999)}"
                orphan_amount = to_decimal(rng.choice([999, 1499, 2499, 4999, 8500]))
                
                now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
                out_settlements.append({
                    "settlement_id": orphan_sid,
                    "payment_id": orphan_pid,
                    "settlement_amount": orphan_amount,
                    "settlement_status": "SETTLED",
                    "settlement_date": now_str
                })

                ground_truth.append({
                    "anomaly_id": f"AN_{anomaly_counter:04d}",
                    "dataset_id": dataset_id,
                    "anomaly_type": "ORPHAN_SETTLEMENT",
                    "payment_id": orphan_pid,
                    "settlement_id": orphan_sid,
                    "refund_id": "",
                    "expected_amount": Decimal("0.00"),
                    "actual_amount": orphan_amount,
                    "difference": orphan_amount,
                    "severity": "CRITICAL",
                    "description": "Settlement payout references non-existent payment identifier."
                })
                breakdown["ORPHAN_SETTLEMENT"] += 1
                anomaly_counter += 1

        return out_payments, out_settlements, out_refunds, out_fees, ground_truth, breakdown


anomaly_injector = AnomalyInjectorService()
