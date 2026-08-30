from typing import Dict, Any, List
from app.schemas.ask import AskIntent, QueryPlan
from app.services.reconciliation_engine import reconciliation_engine
from app.services.exception_detector import exception_detector
from app.services.dataset_service import dataset_service


class QueryExecutorService:
    """
    Executes safe, predefined backend data retrieval operations strictly scoped to dataset_id.
    Zero arbitrary database execution; uses aggregation-first retrieval.
    """

    async def _get_or_detect_exceptions_summary(self, dataset_id: str) -> Dict[str, Any]:
        exc_summary = await exception_detector.get_summary(dataset_id)
        if not exc_summary:
            det_res = await exception_detector.detect_exceptions(dataset_id)
            return det_res.summary.model_dump()
        return exc_summary.model_dump() if hasattr(exc_summary, "model_dump") else dict(exc_summary)

    async def _get_or_run_reconciliation_summary(self, dataset_id: str) -> Dict[str, Any]:
        recon_summary = await reconciliation_engine.get_summary(dataset_id)
        if not recon_summary:
            recon_res = await reconciliation_engine.reconcile(dataset_id)
            return recon_res.model_dump()
        return recon_summary

    async def execute_plan(self, dataset_id: str, plan: QueryPlan) -> Dict[str, Any]:
        intent = plan.intent

        # 1. Un-queriable cases (Off topic / Unsupported)
        if intent == AskIntent.OFF_TOPIC:
            return {
                "type": "OFF_TOPIC",
                "message": "Off-topic query redirected."
            }

        if intent == AskIntent.UNSUPPORTED_QUESTION:
            return {
                "type": "UNSUPPORTED_QUESTION",
                "message": "Future predictions, fraud claims, or non-dataset attributes are not available in the current financial dataset."
            }

        # 2. DATASET_SUMMARY
        if intent == AskIntent.DATASET_SUMMARY:
            recon_summary = await self._get_or_run_reconciliation_summary(dataset_id)
            exc_summary = await self._get_or_detect_exceptions_summary(dataset_id)
            return {
                "type": "DATASET_SUMMARY",
                "reconciliation": recon_summary,
                "exceptions": exc_summary
            }

        # 3. FINANCIAL_DISCREPANCY
        if intent == AskIntent.FINANCIAL_DISCREPANCY:
            recon_summary = await self._get_or_run_reconciliation_summary(dataset_id)
            exc_summary = await self._get_or_detect_exceptions_summary(dataset_id)
            top_exceptions, _ = await exception_detector.get_exceptions(
                dataset_id=dataset_id,
                limit=3
            )
            return {
                "type": "FINANCIAL_DISCREPANCY",
                "reconciliation": recon_summary,
                "exceptions": exc_summary,
                "top_contributors": top_exceptions
            }

        # 4. EXCEPTION_BREAKDOWN
        if intent == AskIntent.EXCEPTION_BREAKDOWN:
            exc_summary = await self._get_or_detect_exceptions_summary(dataset_id)
            return {
                "type": "EXCEPTION_BREAKDOWN",
                "summary": exc_summary
            }

        # 5. TOP_EXCEPTIONS
        if intent == AskIntent.TOP_EXCEPTIONS:
            exc_summary = await self._get_or_detect_exceptions_summary(dataset_id)
            top_items, total = await exception_detector.get_exceptions(
                dataset_id=dataset_id,
                severity=plan.severity,
                limit=plan.limit
            )
            return {
                "type": "TOP_EXCEPTIONS",
                "total_exceptions": total,
                "summary": exc_summary,
                "items": top_items
            }

        # 6. Specific Exception Type Queries (MISSING, DUPLICATE, AMOUNT_MISMATCH, REFUND, FEE, DELAYED, ORPHAN)
        type_mapping = {
            AskIntent.MISSING_SETTLEMENTS: "MISSING_SETTLEMENT",
            AskIntent.DUPLICATE_SETTLEMENTS: "DUPLICATE_SETTLEMENT",
            AskIntent.AMOUNT_MISMATCHES: "AMOUNT_MISMATCH",
            AskIntent.REFUND_ISSUES: "REFUND_MISMATCH",
            AskIntent.FEE_ISSUES: "FEE_ANOMALY",
            AskIntent.DELAYED_SETTLEMENTS: "DELAYED_SETTLEMENT",
            AskIntent.ORPHAN_SETTLEMENTS: "ORPHAN_SETTLEMENT",
        }

        if intent in type_mapping:
            exc_type = type_mapping[intent]
            items, total = await exception_detector.get_exceptions(
                dataset_id=dataset_id,
                exception_type=exc_type,
                severity=plan.severity,
                limit=plan.limit
            )
            total_impact = sum(item.get("financial_impact", item.get("amount_discrepancy", 0.0)) for item in items)
            return {
                "type": intent.value,
                "exception_type": exc_type,
                "count": total,
                "total_impact": round(total_impact, 2),
                "items": items
            }

        # 7. TRANSACTION_LOOKUP
        if intent == AskIntent.TRANSACTION_LOOKUP:
            pid = plan.payment_id
            ord_id = plan.order_id

            # Search in payments across memory / disk benchmark / MongoDB
            payments, settlements_all, refunds_all, fees_all = await reconciliation_engine._fetch_all_records(dataset_id)
            target_payment = None
            if pid:
                target_payment = next((p for p in payments if str(p.get("payment_id", "")).upper() == pid.upper()), None)
            elif ord_id:
                target_payment = next((p for p in payments if str(p.get("order_id", "")).upper() == ord_id.upper()), None)

            if not target_payment:
                return {
                    "type": "TRANSACTION_LOOKUP",
                    "found": False,
                    "payment_id": pid or ord_id,
                    "message": f"No transaction found with reference '{pid or ord_id}' in this dataset."
                }

            resolved_pid = str(target_payment.get("payment_id"))
            settlements = [s for s in settlements_all if str(s.get("payment_id")) == resolved_pid]
            refunds = [r for r in refunds_all if str(r.get("payment_id")) == resolved_pid]
            fees = next((f for f in fees_all if str(f.get("payment_id")) == resolved_pid), None)

            # Check if flagged as exception
            all_exceptions, _ = await exception_detector.get_exceptions(dataset_id=dataset_id, limit=10000)
            matching_exc = next((e for e in all_exceptions if str(e.get("payment_id")) == resolved_pid), None)

            return {
                "type": "TRANSACTION_LOOKUP",
                "found": True,
                "payment": target_payment,
                "settlements": settlements,
                "refunds": refunds,
                "fee": fees,
                "exception": matching_exc
            }

        # Fallback
        recon_summary = await self._get_or_run_reconciliation_summary(dataset_id)
        return {
            "type": "FALLBACK",
            "summary": recon_summary
        }


query_executor = QueryExecutorService()
