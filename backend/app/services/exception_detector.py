import time
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Tuple, Optional
from app.utils.money import to_decimal
from app.schemas.exceptions import DetectedException, ExceptionSummary, DetectionResponse
from app.services.dataset_service import dataset_service
from app.services.data_generator import data_generator
from app.db.session import db_manager
from app.utils.exception_rules import (
    check_missing_settlement,
    check_duplicate_settlement,
    check_fee_anomaly,
    check_refund_mismatch,
    check_delayed_settlement,
    check_amount_mismatch,
    check_orphan_settlement,
    STANDARD_MDR_RATE,
    STANDARD_GST_RATE,
)

PRECEDENCE_ORDER = [
    "ORPHAN_SETTLEMENT",
    "MISSING_SETTLEMENT",
    "DUPLICATE_SETTLEMENT",
    "REFUND_MISMATCH",
    "FEE_ANOMALY",
    "DELAYED_SETTLEMENT",
    "AMOUNT_MISMATCH",
]


class ExceptionDetectionService:
    def __init__(self):
        self._exceptions_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._summary_cache: Dict[str, Dict[str, Any]] = {}

    async def detect_exceptions(self, dataset_id: str) -> DetectionResponse:
        """
        Executes deterministic anomaly detection and exception classification across the dataset.
        Assigns severity, financial impact, structured evidence, and secondary signals.
        """
        payments, settlements, refunds, fees = await self._fetch_all_records(dataset_id)

        # Index records
        payment_map: Dict[str, Dict[str, Any]] = {str(p["payment_id"]): p for p in payments}
        
        settlements_by_pid: Dict[str, List[Dict[str, Any]]] = {}
        for s in settlements:
            pid = str(s["payment_id"])
            settlements_by_pid.setdefault(pid, []).append(s)

        refunds_by_pid: Dict[str, List[Dict[str, Any]]] = {}
        for r in refunds:
            pid = str(r["payment_id"])
            refunds_by_pid.setdefault(pid, []).append(r)

        fees_by_pid: Dict[str, Dict[str, Any]] = {str(f["payment_id"]): f for f in fees}

        detected: List[Dict[str, Any]] = []
        counter = 1

        # Summary accumulators
        category_counts: Dict[str, int] = {k.lower() + "_count": 0 for k in PRECEDENCE_ORDER}
        category_impacts: Dict[str, Decimal] = {k.lower() + "_impact": Decimal("0.00") for k in PRECEDENCE_ORDER}
        severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}

        # 1. Process all Payments
        for pid, payment in payment_map.items():
            if payment.get("payment_status") != "SUCCESS":
                continue

            amount = to_decimal(payment.get("amount", "0"))
            p_refunds = refunds_by_pid.get(pid, [])
            p_settlements = settlements_by_pid.get(pid, [])
            p_fee = fees_by_pid.get(pid)

            total_refund = sum((to_decimal(r.get("refund_amount", "0")) for r in p_refunds), Decimal("0.00"))
            
            if p_fee:
                fee_amount = to_decimal(p_fee.get("fee_amount", "0"))
                tax_amount = to_decimal(p_fee.get("tax_amount", "0"))
            else:
                fee_amount = (amount * STANDARD_MDR_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                tax_amount = (fee_amount * STANDARD_GST_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            expected_settlement = (amount - total_refund - fee_amount - tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if expected_settlement < Decimal("0.00"):
                expected_settlement = Decimal("0.00")

            actual_settlement = sum((to_decimal(s.get("settlement_amount", "0")) for s in p_settlements), Decimal("0.00"))

            # Run all rules
            signals: List[Dict[str, Any]] = []

            # Rule: Missing Settlement
            sig_missing = check_missing_settlement(payment, p_settlements, expected_settlement)
            if sig_missing:
                signals.append(sig_missing)

            # Rule: Duplicate Settlement
            sig_dup = check_duplicate_settlement(payment, p_settlements, expected_settlement)
            if sig_dup:
                signals.append(sig_dup)

            # Rule: Fee Anomaly
            sig_fee = check_fee_anomaly(payment, p_fee)
            if sig_fee:
                signals.append(sig_fee)

            # Rule: Refund Mismatch
            sig_refund = check_refund_mismatch(payment, p_refunds, p_settlements, fee_amount, tax_amount)
            if sig_refund:
                signals.append(sig_refund)

            # Rule: Delayed Settlement (if settlement exists)
            if p_settlements:
                sig_delay = check_delayed_settlement(payment, p_settlements[0])
                if sig_delay:
                    signals.append(sig_delay)

            # Rule: Amount Mismatch (if single settlement exists and diff > 0.01)
            if len(p_settlements) == 1:
                sig_amt = check_amount_mismatch(expected_settlement, to_decimal(p_settlements[0]["settlement_amount"]))
                if sig_amt:
                    signals.append(sig_amt)

            if not signals:
                continue

            # Select primary exception by precedence
            primary_signal = min(signals, key=lambda s: PRECEDENCE_ORDER.index(s["type"]))
            primary_type = primary_signal["type"]
            secondary = [s["type"] for s in signals if s["type"] != primary_type]

            # Build machine-readable evidence
            evidence = {
                "payment": {
                    "payment_id": pid,
                    "order_id": payment.get("order_id"),
                    "merchant_id": payment.get("merchant_id"),
                    "amount": str(amount),
                    "currency": payment.get("currency", "INR"),
                    "status": payment.get("payment_status"),
                    "created_at": payment.get("created_at"),
                },
                "refunds": [
                    {"refund_id": r.get("refund_id"), "amount": str(r.get("refund_amount")), "date": r.get("refund_date")}
                    for r in p_refunds
                ],
                "fees": {
                    "fee_amount": str(fee_amount),
                    "tax_amount": str(tax_amount),
                },
                "settlements": [
                    {"settlement_id": s.get("settlement_id"), "amount": str(s.get("settlement_amount")), "date": s.get("settlement_date")}
                    for s in p_settlements
                ],
                "calculation": {
                    "expected_settlement": str(expected_settlement),
                    "actual_settlement": str(actual_settlement),
                    "difference": str(primary_signal["difference"]),
                    "financial_impact": str(primary_signal["financial_impact"]),
                },
                "rule": {
                    "name": primary_type,
                    "reason": primary_signal.get("reason", primary_signal["description"]),
                },
                "details": primary_signal.get("evidence_details", {})
            }

            exc_doc = {
                "exception_id": f"EXC_{dataset_id}_{counter:05d}",
                "dataset_id": dataset_id,
                "payment_id": pid,
                "order_id": payment.get("order_id"),
                "primary_exception_type": primary_type,
                "exception_type": primary_type,
                "severity": primary_signal["severity"],
                "status": "OPEN",
                "financial_impact": float(primary_signal["financial_impact"]),
                "difference": float(primary_signal["difference"]),
                "confidence": 1.0,
                "detected_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "secondary_signals": secondary,
                "description": primary_signal["description"],
                "evidence": evidence,
            }
            detected.append(exc_doc)
            counter += 1

            # Accumulate metrics
            key_c = primary_type.lower() + "_count"
            key_i = primary_type.lower() + "_impact"
            if key_c in category_counts:
                category_counts[key_c] += 1
            if key_i in category_impacts:
                category_impacts[key_i] += primary_signal["financial_impact"]
            severity_counts[primary_signal["severity"]] += 1

        # 2. Process Orphan Settlements
        for pid, s_list in settlements_by_pid.items():
            if pid not in payment_map:
                for s in s_list:
                    sig_orphan = check_orphan_settlement(s)
                    evidence = {
                        "payment": None,
                        "refunds": [],
                        "fees": None,
                        "settlements": [
                            {"settlement_id": s.get("settlement_id"), "amount": str(s.get("settlement_amount")), "date": s.get("settlement_date")}
                        ],
                        "calculation": {
                            "expected_settlement": "0.00",
                            "actual_settlement": str(s["settlement_amount"]),
                            "difference": str(s["settlement_amount"]),
                            "financial_impact": str(s["settlement_amount"]),
                        },
                        "rule": {
                            "name": "ORPHAN_SETTLEMENT",
                            "reason": sig_orphan["reason"],
                        },
                        "details": sig_orphan["evidence_details"]
                    }

                    exc_doc = {
                        "exception_id": f"EXC_{dataset_id}_{counter:05d}",
                        "dataset_id": dataset_id,
                        "payment_id": pid,
                        "settlement_id": s.get("settlement_id"),
                        "order_id": None,
                        "primary_exception_type": "ORPHAN_SETTLEMENT",
                        "exception_type": "ORPHAN_SETTLEMENT",
                        "severity": "CRITICAL",
                        "status": "OPEN",
                        "financial_impact": float(sig_orphan["financial_impact"]),
                        "difference": float(sig_orphan["difference"]),
                        "confidence": 1.0,
                        "detected_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "secondary_signals": [],
                        "description": sig_orphan["description"],
                        "evidence": evidence,
                    }
                    detected.append(exc_doc)
                    counter += 1

                    category_counts["orphan_settlement_count"] += 1
                    category_impacts["orphan_settlement_impact"] += to_decimal(sig_orphan["financial_impact"])
                    severity_counts["CRITICAL"] += 1

        total_impact = sum(category_impacts.values(), Decimal("0.00"))

        summary = ExceptionSummary(
            dataset_id=dataset_id,
            total_exceptions=len(detected),
            critical_count=severity_counts["CRITICAL"],
            high_count=severity_counts["HIGH"],
            medium_count=severity_counts["MEDIUM"],
            low_count=severity_counts["LOW"],
            missing_settlement_count=category_counts["missing_settlement_count"],
            duplicate_settlement_count=category_counts["duplicate_settlement_count"],
            amount_mismatch_count=category_counts["amount_mismatch_count"],
            refund_mismatch_count=category_counts["refund_mismatch_count"],
            fee_anomaly_count=category_counts["fee_anomaly_count"],
            delayed_settlement_count=category_counts["delayed_settlement_count"],
            orphan_settlement_count=category_counts["orphan_settlement_count"],
            total_financial_impact=float(total_impact),
            missing_settlement_impact=float(category_impacts["missing_settlement_impact"]),
            duplicate_settlement_impact=float(category_impacts["duplicate_settlement_impact"]),
            amount_mismatch_impact=float(category_impacts["amount_mismatch_impact"]),
            refund_mismatch_impact=float(category_impacts["refund_mismatch_impact"]),
            fee_anomaly_impact=float(category_impacts["fee_anomaly_impact"]),
            delayed_settlement_impact=float(category_impacts["delayed_settlement_impact"]),
            orphan_settlement_impact=float(category_impacts["orphan_settlement_impact"]),
        )

        # 3. Persist Idempotently
        await self._persist_exceptions(dataset_id, summary, detected)

        return DetectionResponse(
            success=True,
            dataset_id=dataset_id,
            exceptions_detected=len(detected),
            summary=summary
        )

    async def _fetch_all_records(self, dataset_id: str):
        if dataset_id in data_generator._cache:
            cache = data_generator._cache[dataset_id]
            return cache["payments"], cache["settlements"], cache["refunds"], cache["fees"]

        disk_cache = data_generator.load_dataset_from_disk(dataset_id)
        if disk_cache:
            return disk_cache["payments"], disk_cache["settlements"], disk_cache["refunds"], disk_cache["fees"]

        p = await dataset_service.get_records(dataset_id, "payments")
        s = await dataset_service.get_records(dataset_id, "settlements")
        r = await dataset_service.get_records(dataset_id, "refunds")
        f = await dataset_service.get_records(dataset_id, "fees")
        return p, s, r, f

    async def _persist_exceptions(self, dataset_id: str, summary: ExceptionSummary, exceptions: List[Dict[str, Any]]):
        self._exceptions_cache[dataset_id] = exceptions
        self._summary_cache[dataset_id] = summary.model_dump()

        db = db_manager.get_db()
        if db is not None:
            await db["reconciliation_exceptions"].delete_many({"dataset_id": dataset_id})
            await db["exception_summaries"].delete_many({"dataset_id": dataset_id})

            await db["exception_summaries"].insert_one(summary.model_dump())
            if exceptions:
                await db["reconciliation_exceptions"].insert_many([dict(e) for e in exceptions])

    async def get_summary(self, dataset_id: str) -> Optional[ExceptionSummary]:
        if dataset_id in self._summary_cache:
            return ExceptionSummary(**self._summary_cache[dataset_id])

        db = db_manager.get_db()
        if db is not None:
            doc = await db["exception_summaries"].find_one({"dataset_id": dataset_id}, {"_id": 0})
            if doc:
                return ExceptionSummary(**doc)
        return None

    async def get_exceptions(
        self,
        dataset_id: str,
        severity: Optional[str] = None,
        exception_type: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 50
    ) -> Tuple[List[Dict[str, Any]], int]:
        all_exc = self._exceptions_cache.get(dataset_id, [])

        if not all_exc:
            db = db_manager.get_db()
            if db is not None:
                cursor = db["reconciliation_exceptions"].find({"dataset_id": dataset_id}, {"_id": 0})
                all_exc = await cursor.to_list(length=None)
                self._exceptions_cache[dataset_id] = all_exc

        filtered = all_exc
        if severity and severity != "ALL":
            filtered = [e for e in filtered if e.get("severity") == severity]
        if exception_type and exception_type != "ALL":
            filtered = [e for e in filtered if e.get("primary_exception_type") == exception_type or e.get("exception_type") == exception_type]
        if status and status != "ALL":
            filtered = [e for e in filtered if e.get("status") == status]

        total = len(filtered)
        start = (page - 1) * limit
        end = start + limit
        return filtered[start:end], total

    async def get_exception_detail(self, dataset_id: str, exception_id: str) -> Optional[Dict[str, Any]]:
        exceptions, _ = await self.get_exceptions(dataset_id, limit=100000)
        for e in exceptions:
            if e["exception_id"] == exception_id:
                return e
        return None


exception_detector = ExceptionDetectionService()
