import time
import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Tuple, Optional
from app.utils.money import to_decimal
from app.schemas.financial import ExceptionType, SeverityLevel
from app.schemas.reconciliation import ReconcileResponse, ExceptionDetailResponse
from app.services.dataset_service import dataset_service
from app.services.data_generator import data_generator
from app.db.session import db_manager

STANDARD_SLA_DAYS = 3
STANDARD_MDR_RATE = Decimal("0.018")
GST_RATE = Decimal("0.18")


class ReconciliationEngine:
    def __init__(self):
        # In-memory store for reconciled results
        self._reconciled_summaries: Dict[str, Dict[str, Any]] = {}
        self._reconciled_exceptions: Dict[str, List[Dict[str, Any]]] = {}

    async def reconcile(self, dataset_id: str) -> ReconcileResponse:
        """
        Executes deterministic, auditable reconciliation over the dataset session.
        Calculates expected settlement vs actual credits and classifies all 7 exception types.
        """
        start_time = time.perf_counter()

        # 1. Fetch records (from dataset_service or generator cache)
        payments, settlements, refunds, fees = await self._fetch_all_records(dataset_id)

        # 2. Build index maps
        payment_map: Dict[str, Dict[str, Any]] = {}
        for p in payments:
            pid = str(p["payment_id"])
            payment_map[pid] = {
                "payment_id": pid,
                "order_id": str(p.get("order_id", "")),
                "merchant_id": str(p.get("merchant_id", "")),
                "amount": to_decimal(p.get("amount", "0")),
                "currency": str(p.get("currency", "INR")).upper(),
                "payment_status": str(p.get("payment_status", "SUCCESS")).upper(),
                "payment_method": p.get("payment_method"),
                "created_at": str(p.get("created_at", "")),
            }

        # Settlements grouped by payment_id
        settlements_by_pid: Dict[str, List[Dict[str, Any]]] = {}
        all_settled_sids: set[str] = set()
        for s in settlements:
            pid = str(s["payment_id"])
            sid = str(s.get("settlement_id", ""))
            all_settled_sids.add(sid)
            s_doc = {
                "settlement_id": sid,
                "payment_id": pid,
                "settlement_amount": to_decimal(s.get("settlement_amount", "0")),
                "settlement_status": str(s.get("settlement_status", "SETTLED")).upper(),
                "settlement_date": str(s.get("settlement_date", "")),
            }
            settlements_by_pid.setdefault(pid, []).append(s_doc)

        # Refunds grouped by payment_id
        refunds_by_pid: Dict[str, List[Dict[str, Any]]] = {}
        for r in refunds:
            pid = str(r["payment_id"])
            r_doc = {
                "refund_id": str(r.get("refund_id", "")),
                "payment_id": pid,
                "refund_amount": to_decimal(r.get("refund_amount", "0")),
                "refund_status": str(r.get("refund_status", "PROCESSED")).upper(),
                "refund_date": str(r.get("refund_date", "")),
            }
            refunds_by_pid.setdefault(pid, []).append(r_doc)

        # Fees indexed by payment_id
        fees_by_pid: Dict[str, Dict[str, Any]] = {}
        for f in fees:
            pid = str(f["payment_id"])
            fees_by_pid[pid] = {
                "payment_id": pid,
                "fee_amount": to_decimal(f.get("fee_amount", "0")),
                "tax_amount": to_decimal(f.get("tax_amount", "0")),
            }

        # 3. Process Reconciliation Loop
        exceptions: List[Dict[str, Any]] = []
        matched_count = 0
        total_volume = Decimal("0.00")
        total_expected_settlement = Decimal("0.00")
        total_actual_settlement = Decimal("0.00")

        processed_pids: set[str] = set()
        exc_counter = 1

        for pid, payment in payment_map.items():
            processed_pids.add(pid)
            amount = payment["amount"]
            status = payment["payment_status"]

            if status != "SUCCESS":
                # Check if an invalid settlement was credited for a failed payment
                if pid in settlements_by_pid:
                    actual_settled = sum((s["settlement_amount"] for s in settlements_by_pid[pid]), Decimal("0.00"))
                    exc = self._build_exception(
                        exc_id=f"EXC_{dataset_id}_{exc_counter:05d}",
                        dataset_id=dataset_id,
                        payment=payment,
                        exc_type=ExceptionType.AMOUNT_MISMATCH,
                        severity=SeverityLevel.CRITICAL,
                        expected=Decimal("0.00"),
                        actual=actual_settled,
                        description=f"Settlement credited for non-successful payment (Status: {status}).",
                        evidence={"reason": "FAILED_PAYMENT_SETTLED", "status": status}
                    )
                    exceptions.append(exc)
                    exc_counter += 1
                    total_actual_settlement += actual_settled
                continue

            total_volume += amount

            # Total refunds for this payment
            p_refunds = refunds_by_pid.get(pid, [])
            refund_total = sum((r["refund_amount"] for r in p_refunds), Decimal("0.00"))

            # Fee & Tax
            if pid in fees_by_pid:
                fee_amount = fees_by_pid[pid]["fee_amount"]
                tax_amount = fees_by_pid[pid]["tax_amount"]
            else:
                fee_amount = (amount * STANDARD_MDR_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                tax_amount = (fee_amount * GST_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # Contractual fee check
            contractual_fee = (amount * STANDARD_MDR_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # Expected Net Settlement = Payment - Refund - Fee - Tax
            expected_settlement = (amount - refund_total - fee_amount - tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if expected_settlement < Decimal("0.00"):
                expected_settlement = Decimal("0.00")

            total_expected_settlement += expected_settlement

            # Associated Settlements
            p_settlements = settlements_by_pid.get(pid, [])

            # --- EXCEPTION CHECK 1: MISSING SETTLEMENT ---
            if not p_settlements:
                exc = self._build_exception(
                    exc_id=f"EXC_{dataset_id}_{exc_counter:05d}",
                    dataset_id=dataset_id,
                    payment=payment,
                    exc_type=ExceptionType.MISSING_SETTLEMENT,
                    severity=SeverityLevel.CRITICAL if expected_settlement > Decimal("1000.00") else SeverityLevel.HIGH,
                    expected=expected_settlement,
                    actual=Decimal("0.00"),
                    description=f"Successful payment of ₹{amount:,.2f} has no matching settlement record.",
                    evidence={
                        "payment_amount": float(amount),
                        "refund_deduction": float(refund_total),
                        "fee_deduction": float(fee_amount + tax_amount),
                        "expected_settlement": float(expected_settlement),
                        "actual_settlement": 0.0,
                    }
                )
                exceptions.append(exc)
                exc_counter += 1
                continue

            # --- EXCEPTION CHECK 2: DUPLICATE SETTLEMENT ---
            if len(p_settlements) > 1:
                actual_total = sum((s["settlement_amount"] for s in p_settlements), Decimal("0.00"))
                total_actual_settlement += actual_total
                sids = [s["settlement_id"] for s in p_settlements]
                exc = self._build_exception(
                    exc_id=f"EXC_{dataset_id}_{exc_counter:05d}",
                    dataset_id=dataset_id,
                    payment=payment,
                    exc_type=ExceptionType.DUPLICATE_SETTLEMENT,
                    severity=SeverityLevel.CRITICAL,
                    expected=expected_settlement,
                    actual=actual_total,
                    description=f"Payment mapped to {len(p_settlements)} duplicate settlements: {', '.join(sids)}.",
                    evidence={
                        "settlement_ids": sids,
                        "duplicate_count": len(p_settlements),
                        "expected_settlement": float(expected_settlement),
                        "actual_settlement": float(actual_total),
                    }
                )
                exceptions.append(exc)
                exc_counter += 1
                continue

            # Single settlement case
            settlement = p_settlements[0]
            actual_settlement = settlement["settlement_amount"]
            total_actual_settlement += actual_settlement

            # --- EXCEPTION CHECK 3: FEE ANOMALY ---
            if fee_amount > (contractual_fee * Decimal("2.0")):
                exc = self._build_exception(
                    exc_id=f"EXC_{dataset_id}_{exc_counter:05d}",
                    dataset_id=dataset_id,
                    payment=payment,
                    settlement=settlement,
                    exc_type=ExceptionType.UNEXPECTED_FEE,
                    severity=SeverityLevel.MEDIUM,
                    expected=contractual_fee,
                    actual=fee_amount,
                    description=f"Processing fee (₹{fee_amount:,.2f}) significantly exceeds contractual MDR (₹{contractual_fee:,.2f}).",
                    evidence={
                        "contractual_fee": float(contractual_fee),
                        "charged_fee": float(fee_amount),
                        "tax_amount": float(tax_amount),
                        "excess_fee": float(fee_amount - contractual_fee)
                    }
                )
                exceptions.append(exc)
                exc_counter += 1
                continue

            # --- EXCEPTION CHECK 4: REFUND MISMATCH ---
            if refund_total > Decimal("0.00"):
                expected_without_refund = (amount - fee_amount - tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                if abs(actual_settlement - expected_without_refund) <= Decimal("0.01") and refund_total > Decimal("0.00"):
                    exc = self._build_exception(
                        exc_id=f"EXC_{dataset_id}_{exc_counter:05d}",
                        dataset_id=dataset_id,
                        payment=payment,
                        settlement=settlement,
                        exc_type=ExceptionType.REFUND_MISMATCH,
                        severity=SeverityLevel.HIGH,
                        expected=expected_settlement,
                        actual=actual_settlement,
                        description=f"Refund of ₹{refund_total:,.2f} processed but settlement credit was not deducted.",
                        evidence={
                            "refund_amount": float(refund_total),
                            "expected_net_settlement": float(expected_settlement),
                            "actual_settlement": float(actual_settlement),
                            "undeducted_refund": float(refund_total)
                        }
                    )
                    exceptions.append(exc)
                    exc_counter += 1
                    continue

            # --- EXCEPTION CHECK 5: AMOUNT MISMATCH ---
            discrepancy = abs(expected_settlement - actual_settlement)
            if discrepancy > Decimal("0.01"):
                exc = self._build_exception(
                    exc_id=f"EXC_{dataset_id}_{exc_counter:05d}",
                    dataset_id=dataset_id,
                    payment=payment,
                    settlement=settlement,
                    exc_type=ExceptionType.AMOUNT_MISMATCH,
                    severity=SeverityLevel.HIGH if discrepancy > Decimal("1000.00") else SeverityLevel.MEDIUM,
                    expected=expected_settlement,
                    actual=actual_settlement,
                    description=f"Actual settlement (₹{actual_settlement:,.2f}) differs from calculated expected settlement (₹{expected_settlement:,.2f}).",
                    evidence={
                        "expected_settlement": float(expected_settlement),
                        "actual_settlement": float(actual_settlement),
                        "discrepancy": float(discrepancy)
                    }
                )
                exceptions.append(exc)
                exc_counter += 1
                continue

            # --- EXCEPTION CHECK 6: DELAYED SETTLEMENT ---
            p_created = payment["created_at"]
            s_date = settlement["settlement_date"]
            if p_created and s_date:
                try:
                    p_dt = datetime.strptime(p_created[:10], "%Y-%m-%d")
                    s_dt = datetime.strptime(s_date[:10], "%Y-%m-%d")
                    delta_days = (s_dt - p_dt).days
                    if delta_days > STANDARD_SLA_DAYS + 3:
                        exc = self._build_exception(
                            exc_id=f"EXC_{dataset_id}_{exc_counter:05d}",
                            dataset_id=dataset_id,
                            payment=payment,
                            settlement=settlement,
                            exc_type=ExceptionType.DELAYED_SETTLEMENT,
                            severity=SeverityLevel.MEDIUM,
                            expected=expected_settlement,
                            actual=actual_settlement,
                            description=f"Settlement was credited {delta_days} days after payment (exceeds {STANDARD_SLA_DAYS}-day SLA).",
                            evidence={
                                "payment_date": p_created,
                                "settlement_date": s_date,
                                "delay_days": delta_days,
                                "sla_days": STANDARD_SLA_DAYS
                            }
                        )
                        exceptions.append(exc)
                        exc_counter += 1
                        continue
                except Exception:
                    pass

            # No exceptions -> Matched cleanly
            matched_count += 1

        # --- EXCEPTION CHECK 7: ORPHAN SETTLEMENTS ---
        for pid, s_list in settlements_by_pid.items():
            if pid not in payment_map:
                for s in s_list:
                    orphan_amt = s["settlement_amount"]
                    total_actual_settlement += orphan_amt
                    exc = self._build_exception(
                        exc_id=f"EXC_{dataset_id}_{exc_counter:05d}",
                        dataset_id=dataset_id,
                        settlement=s,
                        exc_type=ExceptionType.ORPHAN_SETTLEMENT,
                        severity=SeverityLevel.CRITICAL,
                        expected=Decimal("0.00"),
                        actual=orphan_amt,
                        description=f"Settlement {s['settlement_id']} references uncaptured or missing payment ID '{pid}'.",
                        evidence={
                            "unknown_payment_id": pid,
                            "settlement_id": s["settlement_id"],
                            "orphan_amount": float(orphan_amt)
                        }
                    )
                    exceptions.append(exc)
                    exc_counter += 1

        successful_tx = sum(1 for p in payment_map.values() if p["payment_status"] == "SUCCESS")
        total_tx = len(payment_map)
        exception_count = len(exceptions)
        unexplained_diff = abs(total_expected_settlement - total_actual_settlement)
        
        reconciliation_rate = 0.0
        if successful_tx > 0:
            reconciliation_rate = round((matched_count / successful_tx) * 100, 2)

        # Breakdowns
        exception_breakdown: Dict[str, int] = {}
        for e in exceptions:
            t = str(e["exception_type"].value if hasattr(e["exception_type"], "value") else e["exception_type"])
            exception_breakdown[t] = exception_breakdown.get(t, 0) + 1

        severity_breakdown: Dict[str, int] = {
            "CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0
        }
        for e in exceptions:
            s = str(e["severity"].value if hasattr(e["severity"], "value") else e["severity"])
            severity_breakdown[s] = severity_breakdown.get(s, 0) + 1

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        summary = {
            "dataset_id": dataset_id,
            "total_transactions": total_tx,
            "matched_count": matched_count,
            "exception_count": exception_count,
            "total_volume": float(total_volume),
            "expected_settlement": float(total_expected_settlement),
            "actual_settlement": float(total_actual_settlement),
            "unexplained_difference": float(unexplained_diff),
            "reconciliation_rate": reconciliation_rate,
            "duration_ms": duration_ms,
            "exception_breakdown": exception_breakdown,
            "severity_breakdown": severity_breakdown,
            "reconciled_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        # 4. Save results (Idempotent: clean replacement)
        await self._persist_results(dataset_id, summary, exceptions)

        return ReconcileResponse(
            success=True,
            dataset_id=dataset_id,
            total_transactions=total_tx,
            matched_count=matched_count,
            exception_count=exception_count,
            total_volume=float(total_volume),
            expected_settlement=float(total_expected_settlement),
            actual_settlement=float(total_actual_settlement),
            unexplained_difference=float(unexplained_diff),
            reconciliation_rate=reconciliation_rate,
            duration_ms=duration_ms,
            exception_breakdown=exception_breakdown,
            severity_breakdown=severity_breakdown
        )

    def _build_exception(
        self,
        exc_id: str,
        dataset_id: str,
        exc_type: ExceptionType,
        severity: SeverityLevel,
        expected: Decimal,
        actual: Decimal,
        description: str,
        evidence: Dict[str, Any],
        payment: Optional[Dict[str, Any]] = None,
        settlement: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        discrepancy = abs(expected - actual)
        pid = payment["payment_id"] if payment else (settlement["payment_id"] if settlement else None)
        
        # Build chronological timeline
        timeline: List[Dict[str, Any]] = []
        if payment:
            timeline.append({
                "step": 1,
                "event": "Payment Created",
                "timestamp": payment.get("created_at"),
                "details": f"Amount: ₹{payment['amount']:,.2f} ({payment.get('payment_method', 'N/A')})"
            })
            timeline.append({
                "step": 2,
                "event": f"Payment {payment['payment_status']}",
                "timestamp": payment.get("created_at"),
                "details": f"Order ID: {payment.get('order_id')}"
            })
        if settlement:
            timeline.append({
                "step": 3,
                "event": "Settlement Payout Record",
                "timestamp": settlement.get("settlement_date"),
                "details": f"Settlement ID: {settlement['settlement_id']}, Amount: ₹{settlement['settlement_amount']:,.2f}"
            })
        timeline.append({
            "step": 4,
            "event": f"Discrepancy Flagged: {exc_type.value}",
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "details": description
        })

        return {
            "exception_id": exc_id,
            "dataset_id": dataset_id,
            "payment_id": pid,
            "exception_type": exc_type,
            "severity": severity,
            "amount_discrepancy": float(discrepancy),
            "expected_settlement": float(expected),
            "actual_settlement": float(actual),
            "status": "OPEN",
            "description": description,
            "evidence": evidence,
            "timeline": timeline,
            "created_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        }

    async def _fetch_all_records(self, dataset_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Retrieves raw records from database, in-memory cache, or disk benchmark files."""
        # Check generator cache first if applicable
        if dataset_id in data_generator._cache:
            cache = data_generator._cache[dataset_id]
            return cache["payments"], cache["settlements"], cache["refunds"], cache["fees"]

        # Check disk benchmark cache if present
        disk_cache = data_generator.load_dataset_from_disk(dataset_id)
        if disk_cache:
            return disk_cache["payments"], disk_cache["settlements"], disk_cache["refunds"], disk_cache["fees"]

        # Fetch from dataset_service / MongoDB
        p = await dataset_service.get_records(dataset_id, "payments")
        s = await dataset_service.get_records(dataset_id, "settlements")
        r = await dataset_service.get_records(dataset_id, "refunds")
        f = await dataset_service.get_records(dataset_id, "fees")
        return p, s, r, f

    async def _persist_results(self, dataset_id: str, summary: Dict[str, Any], exceptions: List[Dict[str, Any]]):
        """Persists reconciled summary and exceptions idempotently in DB or memory."""
        self._reconciled_summaries[dataset_id] = summary
        self._reconciled_exceptions[dataset_id] = exceptions

        # Synchronize with exception_detector cache
        from app.services.exception_detector import exception_detector
        exception_detector._exceptions_cache[dataset_id] = exceptions

        db = db_manager.get_db()
        if db is not None:
            # Clear previous runs for idempotency
            await db["reconciliation_summaries"].delete_many({"dataset_id": dataset_id})
            await db["reconciliation_exceptions"].delete_many({"dataset_id": dataset_id})

            await db["reconciliation_summaries"].insert_one(dict(summary))
            if exceptions:
                # Store cleaned docs without ObjectId mutation
                await db["reconciliation_exceptions"].insert_many([dict(e) for e in exceptions])

    async def get_summary(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves reconciled summary for dataset, auto-reconciling if needed."""
        if dataset_id in self._reconciled_summaries:
            return self._reconciled_summaries[dataset_id]

        db = db_manager.get_db()
        if db is not None:
            doc = await db["reconciliation_summaries"].find_one({"dataset_id": dataset_id}, {"_id": 0})
            if doc:
                self._reconciled_summaries[dataset_id] = doc
                return doc

        # On-demand reconciliation for uncomputed active dataset
        try:
            res = await self.reconcile(dataset_id)
            return self._reconciled_summaries.get(dataset_id)
        except Exception:
            return None

    async def get_exceptions(
        self,
        dataset_id: str,
        severity: Optional[SeverityLevel] = None,
        exception_type: Optional[ExceptionType] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 50
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Queries exceptions with filtering, search, and pagination, auto-loading if needed."""
        all_exc = self._reconciled_exceptions.get(dataset_id, [])

        if not all_exc:
            from app.services.exception_detector import exception_detector
            if dataset_id in exception_detector._exceptions_cache and exception_detector._exceptions_cache[dataset_id]:
                all_exc = exception_detector._exceptions_cache[dataset_id]
                self._reconciled_exceptions[dataset_id] = all_exc

        if not all_exc:
            db = db_manager.get_db()
            if db is not None:
                query: Dict[str, Any] = {"dataset_id": dataset_id}
                cursor = db["reconciliation_exceptions"].find(query, {"_id": 0})
                all_exc = await cursor.to_list(length=None)
                self._reconciled_exceptions[dataset_id] = all_exc

        if not all_exc:
            try:
                await self.reconcile(dataset_id)
                all_exc = self._reconciled_exceptions.get(dataset_id, [])
            except Exception:
                pass

        # Apply in-memory filtering
        filtered = all_exc
        if severity:
            sev_str = severity.value if hasattr(severity, "value") else str(severity)
            filtered = [e for e in filtered if (e.get("severity").value if hasattr(e.get("severity"), "value") else str(e.get("severity", "")).upper()) == sev_str.upper()]
        if exception_type:
            type_str = exception_type.value if hasattr(exception_type, "value") else str(exception_type)
            filtered = [e for e in filtered if (e.get("exception_type").value if hasattr(e.get("exception_type"), "value") else str(e.get("exception_type", "")).upper()) == type_str.upper() or str(e.get("primary_exception_type", "")).upper() == type_str.upper()]
        if search:
            q = search.strip().lower()
            filtered = [
                e for e in filtered if
                (e.get("payment_id") and q in str(e["payment_id"]).lower()) or
                (e.get("exception_id") and q in str(e["exception_id"]).lower()) or
                (e.get("description") and q in str(e["description"]).lower())
            ]

        total = len(filtered)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated = filtered[start_idx:end_idx]

        return paginated, total

    async def get_exception_detail(self, dataset_id: str, exception_id: str) -> Optional[Dict[str, Any]]:
        """Fetches individual exception detail."""
        exceptions, _ = await self.get_exceptions(dataset_id=dataset_id, limit=100000)
        for e in exceptions:
            if e.get("exception_id") == exception_id:
                return e
        return None


reconciliation_engine = ReconciliationEngine()
