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
    amt = to_decimal(payment.get("amount", "0"))
    if payment.get("payment_status") == "SUCCESS" and expected_settlement > Decimal("0.00") and len(settlements) == 0:
        return {
            "type": "MISSING_SETTLEMENT",
            "severity": "CRITICAL" if expected_settlement > Decimal("1000.00") else "HIGH",
            "financial_impact": expected_settlement,
            "difference": expected_settlement,
            "description": f"Successful payment of ₹{amt:,.2f} has no settlement record.",
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
        total_settled = sum((to_decimal(s.get("settlement_amount", "0")) for s in settlements), Decimal("0.00"))
        excess = total_settled - expected_settlement
        sids = [str(s.get("settlement_id", "")) for s in settlements]
        amounts = [float(to_decimal(s.get("settlement_amount", "0"))) for s in settlements]
        
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
    amount = to_decimal(payment.get("amount", "0"))
    expected_fee = (amount * STANDARD_MDR_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    if fee_doc:
        actual_fee = to_decimal(fee_doc.get("fee_amount", "0"))
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
        total_refund = sum((to_decimal(r.get("refund_amount", "0")) for r in refunds), Decimal("0.00"))
        amount = to_decimal(payment.get("amount", "0"))
        actual_settled = to_decimal(settlements[0].get("settlement_amount", "0"))
        
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
                    "refund_ids": [r.get("refund_id") for r in refunds],
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
            p_dt = datetime.strptime(str(p_created)[:10], "%Y-%m-%d")
            s_dt = datetime.strptime(str(s_date)[:10], "%Y-%m-%d")
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
                        "payment_created_at": str(p_created),
                        "settlement_date": str(s_date),
                        "delay_days": delta_days,
                        "sla_days": STANDARD_SLA_DAYS,
                    }
                }
        except (ValueError, TypeError):
            pass
    return None


def check_amount_mismatch(
    expected_settlement: Decimal,
    actual_settlement: Decimal
) -> Optional[Dict[str, Any]]:
    """Rule 6: Single settlement exists but net credited amount deviates from expected calculation -> AMOUNT_MISMATCH"""
    exp = to_decimal(expected_settlement)
    act = to_decimal(actual_settlement)
    diff = abs(exp - act).quantize(Decimal("0.01"))
    if diff > Decimal("0.01"):
        return {
            "type": "AMOUNT_MISMATCH",
            "severity": "HIGH" if diff > Decimal("500.00") else "MEDIUM",
            "financial_impact": diff,
            "difference": diff,
            "description": f"Settlement payout credited ₹{act:,.2f}, expected ₹{exp:,.2f} (Discrepancy: ₹{diff:,.2f}).",
            "reason": "Settled batch payout amount does not match expected net calculation after contractual deductions.",
            "evidence_details": {
                "expected_settlement": float(exp),
                "actual_settlement": float(act),
                "difference": float(diff)
            }
        }
    return None


def check_orphan_settlement(
    settlement: Dict[str, Any]
) -> Dict[str, Any]:
    """Rule 7: Settlement record exists with no corresponding captured payment in ledger -> ORPHAN_SETTLEMENT"""
    settled_amt = to_decimal(settlement.get("settlement_amount", "0"))
    return {
        "type": "ORPHAN_SETTLEMENT",
        "severity": "HIGH",
        "financial_impact": settled_amt,
        "difference": settled_amt,
        "description": f"Settlement batch record '{settlement.get('settlement_id')}' (₹{settled_amt:,.2f}) references uncaptured Payment ID '{settlement.get('payment_id')}'.",
        "reason": "Settlement credited by payment gateway for a payment ID not present in merchant transaction ledger.",
        "evidence_details": {
            "settlement_id": settlement.get("settlement_id"),
            "payment_id": settlement.get("payment_id"),
            "settlement_amount": float(settled_amt),
            "settlement_date": settlement.get("settlement_date"),
        }
    }
