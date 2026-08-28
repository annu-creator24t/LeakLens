from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from app.utils.money import to_decimal

STANDARD_MDR_RATE = Decimal("0.018")
STANDARD_GST_RATE = Decimal("0.18")
STANDARD_SLA_DAYS = 3


def check_missing_settlement(
    payment: Dict[str, Any],
    settlements: List[Dict[str, Any]],
    expected_settlement: Decimal
) -> Optional[Dict[str, Any]]:
    """Rule 1: If payment is SUCCESS and expected > 0 but settlement_count == 0 -> MISSING_SETTLEMENT"""
    if payment.get("payment_status") == "SUCCESS" and expected_settlement > Decimal("0.00") and len(settlements) == 0:
        return {
            "type": "MISSING_SETTLEMENT",
            "severity": "CRITICAL" if expected_settlement > Decimal("1000.00") else "HIGH",
            "financial_impact": expected_settlement,
            "difference": expected_settlement,
            "description": f"Successful payment of ₹{payment['amount']:,.2f} has no settlement record.",
            "reason": "Payment captured successfully but payment aggregator did not issue settlement payout.",
        }
    return None


def check_duplicate_settlement(
    payment: Dict[str, Any],
    settlements: List[Dict[str, Any]],
    expected_settlement: Decimal
) -> Optional[Dict[str, Any]]:
    """Rule 2: If settlement_count > 1 -> DUPLICATE_SETTLEMENT vs split settlement verification"""
    if len(settlements) > 1:
        total_settled = sum((s["settlement_amount"] for s in settlements), Decimal("0.00"))
        excess = total_settled - expected_settlement
        sids = [s["settlement_id"] for s in settlements]
        amounts = [float(s["settlement_amount"]) for s in settlements]
        
        # Check if amounts are exact duplicates
        is_exact_dup = len(set(amounts)) < len(amounts)
        
        return {
            "type": "DUPLICATE_SETTLEMENT",
            "severity": "CRITICAL",
            "financial_impact": excess if excess > Decimal("0.00") else Decimal("0.00"),
            "difference": excess if excess > Decimal("0.00") else Decimal("0.00"),
            "description": f"Payment mapped to {len(settlements)} settlement records ({', '.join(sids)}) with excess credit of ₹{excess:,.2f}.",
            "reason": "Multiple settlement batch credits recorded for single captured payment.",
            "evidence_details": {
                "settlement_ids": sids,
                "settlement_amounts": amounts,
                "is_exact_duplicate_amount": is_exact_dup,
                "total_credited": float(total_settled),
                "expected_settlement": float(expected_settlement),
                "excess_amount": float(excess),
            }
        }
    return None


def check_fee_anomaly(
    payment: Dict[str, Any],
    fee_doc: Optional[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Rule 3: If actual fee significantly deviates from expected contractual MDR fee slab -> FEE_ANOMALY"""
    amount = payment["amount"]
    expected_fee = (amount * STANDARD_MDR_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    if fee_doc:
        actual_fee = fee_doc["fee_amount"]
        # If charged fee is > 2.0x expected contractual rate
        if actual_fee > (expected_fee * Decimal("2.0")):
            diff = (actual_fee - expected_fee).quantize(Decimal("0.01"))
            effective_rate = (actual_fee / amount * 100).quantize(Decimal("0.01")) if amount > Decimal("0.00") else Decimal("0.00")
            expected_rate = (STANDARD_MDR_RATE * 100).quantize(Decimal("0.01"))
            return {
                "type": "FEE_ANOMALY",
                "severity": "MEDIUM",
                "financial_impact": diff,
                "difference": diff,
                "description": f"MDR processing fee (₹{actual_fee:,.2f}) deviates from contractual expectation (₹{expected_fee:,.2f}).",
                "reason": f"Charged effective fee rate of {effective_rate}% exceeds standard rate of {expected_rate}%.",
                "evidence_details": {
                    "expected_fee": float(expected_fee),
                    "actual_fee": float(actual_fee),
                    "fee_difference": float(diff),
                    "expected_fee_rate_percent": float(expected_rate),
                    "effective_fee_rate_percent": float(effective_rate),
                }
            }
    return None


def check_refund_mismatch(
    payment: Dict[str, Any],
    refunds: List[Dict[str, Any]],
    settlements: List[Dict[str, Any]],
    fee_amount: Decimal,
    tax_amount: Decimal
) -> Optional[Dict[str, Any]]:
    """Rule 4: Refund processed but settlement credit was not deducted accordingly -> REFUND_MISMATCH"""
    if refunds and settlements:
        total_refund = sum((r["refund_amount"] for r in refunds), Decimal("0.00"))
        amount = payment["amount"]
        actual_settled = settlements[0]["settlement_amount"]
        
        # Expected without refund
        expected_gross_settled = (amount - fee_amount - tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        expected_net_settled = (amount - total_refund - fee_amount - tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if expected_net_settled < Decimal("0.00"):
            expected_net_settled = Decimal("0.00")

        # If actual settlement matches gross (ignoring refund) or does not deduct full refund
        if abs(actual_settled - expected_gross_settled) <= Decimal("0.01") and total_refund > Decimal("0.00"):
            diff = total_refund
            return {
                "type": "REFUND_MISMATCH",
                "severity": "HIGH",
                "financial_impact": diff,
                "difference": diff,
                "description": f"Refund of ₹{total_refund:,.2f} exists but settlement credit was not adjusted.",
                "reason": "Payment gateway processed customer refund without withholding corresponding deduction from merchant settlement payout.",
                "evidence_details": {
                    "refund_ids": [r["refund_id"] for r in refunds],
                    "total_refund_amount": float(total_refund),
                    "expected_net_settlement": float(expected_net_settled),
                    "actual_settlement": float(actual_settled),
                    "undeducted_amount": float(diff)
                }
            }
    return None


def check_delayed_settlement(
    payment: Dict[str, Any],
    settlement: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Rule 5: Settlement date exceeds standard T+2 SLA tolerance window -> DELAYED_SETTLEMENT"""
    p_created = payment.get("created_at")
    s_date = settlement.get("settlement_date")
    if p_created and s_date:
        try:
            p_dt = datetime.strptime(p_created[:10], "%Y-%m-%d")
            s_dt = datetime.strptime(s_date[:10], "%Y-%m-%d")
            delta_days = (s_dt - p_dt).days
            if delta_days > STANDARD_SLA_DAYS + 3:
                return {
                    "type": "DELAYED_SETTLEMENT",
                    "severity": "MEDIUM",
                    "financial_impact": Decimal("0.00"),  # SLA delay has operational/liquidity impact rather than direct missing funds
                    "difference": Decimal("0.00"),
                    "description": f"Settlement was credited {delta_days} days after payment capture (exceeds {STANDARD_SLA_DAYS}-day SLA).",
                    "reason": "Gateway settlement batch delay breached contractual liquidity SLA window.",
                    "evidence_details": {
                        "payment_created_at": p_created,
                        "settlement_date": s_date,
                        "delay_days": delta_days,
                        "sla_days": STANDARD_SLA_DAYS,
                    }
                }
        except Exception:
            pass
    return None


def check_amount_mismatch(
    expected_settlement: Decimal,
    actual_settlement: Decimal
) -> Optional[Dict[str, Any]]:
    """Rule 6: Expected settlement != Actual settlement (when not explained by refund or fee) -> AMOUNT_MISMATCH"""
    diff = (expected_settlement - actual_settlement).quantize(Decimal("0.01"))
    abs_diff = abs(diff)
    
    if abs_diff > Decimal("0.01"):
        pct_diff = Decimal("0.00")
        if expected_settlement > Decimal("0.00"):
            pct_diff = ((abs_diff / expected_settlement) * 100).quantize(Decimal("0.01"))
        
        return {
            "type": "AMOUNT_MISMATCH",
            "severity": "HIGH" if abs_diff > Decimal("1000.00") else "MEDIUM",
            "financial_impact": abs_diff,
            "difference": diff,
            "description": f"Expected settlement (₹{expected_settlement:,.2f}) differs from actual settlement (₹{actual_settlement:,.2f}) by ₹{abs_diff:,.2f}.",
            "reason": "Unexplained variance between deterministic net settlement formula and actual payout credit.",
            "evidence_details": {
                "expected_settlement": float(expected_settlement),
                "actual_settlement": float(actual_settlement),
                "difference": float(diff),
                "percentage_difference": float(pct_diff)
            }
        }
    return None


def check_orphan_settlement(
    settlement: Dict[str, Any]
) -> Dict[str, Any]:
    """Rule 7: Settlement record references a non-existent payment_id -> ORPHAN_SETTLEMENT"""
    amt = settlement["settlement_amount"]
    return {
        "type": "ORPHAN_SETTLEMENT",
        "severity": "CRITICAL",
        "financial_impact": amt,
        "difference": amt,
        "description": f"Settlement {settlement['settlement_id']} references uncaptured or unknown payment ID '{settlement['payment_id']}'.",
        "reason": "Settlement payout credited for an order/payment ID with no corresponding capture record in payments ledger.",
        "evidence_details": {
            "settlement_id": settlement["settlement_id"],
            "unknown_payment_id": settlement["payment_id"],
            "orphan_amount": float(amt),
            "settlement_status": settlement.get("settlement_status", "SETTLED"),
            "settlement_date": settlement.get("settlement_date", ""),
        }
    }
