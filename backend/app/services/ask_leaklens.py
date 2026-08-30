import time
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.schemas.ask import (
    AskIntent,
    QueryPlan,
    EvidenceItem,
    AskAIAnswer,
    AskRequest,
    AskResponse,
    ChatMessage,
    ConversationHistoryResponse
)
from app.services.query_planner import query_planner
from app.services.query_executor import query_executor
from app.db.session import db_manager


class AskLeakLensService:
    def __init__(self):
        self._conversations: Dict[str, Dict[str, Any]] = {}
        self._messages: Dict[str, List[ChatMessage]] = {}

    async def ask(self, dataset_id: str, request: AskRequest) -> AskResponse:
        total_start = time.perf_counter()
        question = request.question.strip()
        conv_id = request.conversation_id or f"conv_{uuid.uuid4().hex[:12]}"

        # 1. Retrieve Conversation History / Context
        history = self._get_conversation_context(conv_id)
        last_context = history[-1] if history else None
        prev_plan = last_context.query_plan if last_context and hasattr(last_context, "query_plan") and last_context.query_plan else {}
        prev_pid = prev_plan.get("payment_id") if isinstance(prev_plan, dict) else None

        # 2. Query Planning
        plan_start = time.perf_counter()
        plan = query_planner.plan_query(
            question=question,
            previous_context={
                "intent": last_context.intent if last_context else None,
                "payment_id": prev_pid
            } if last_context else None
        )
        plan_duration_ms = round((time.perf_counter() - plan_start) * 1000, 2)

        # 3. Query Execution & Aggregation
        exec_start = time.perf_counter()
        evidence_data = await query_executor.execute_plan(dataset_id=dataset_id, plan=plan)
        exec_duration_ms = round((time.perf_counter() - exec_start) * 1000, 2)

        # 4. LLM / Mock Grounded Reasoning
        gen_start = time.perf_counter()
        ai_answer = self._generate_grounded_answer(dataset_id, question, plan, evidence_data)
        gen_duration_ms = round((time.perf_counter() - gen_start) * 1000, 2)
        total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)

        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        # 5. Persist User Message & Assistant Message
        user_msg = ChatMessage(
            message_id=f"msg_{uuid.uuid4().hex[:10]}",
            conversation_id=conv_id,
            role="user",
            content=question,
            intent=plan.intent,
            created_at=now_str
        )
        assistant_msg = ChatMessage(
            message_id=f"msg_{uuid.uuid4().hex[:10]}",
            conversation_id=conv_id,
            role="assistant",
            content=ai_answer.answer,
            intent=plan.intent,
            query_plan=plan.model_dump(),
            evidence=ai_answer.evidence,
            created_at=now_str
        )

        await self._persist_messages(dataset_id, conv_id, [user_msg, assistant_msg])

        return AskResponse(
            success=True,
            conversation_id=conv_id,
            question=question,
            intent=plan.intent,
            answer=ai_answer.answer,
            key_findings=ai_answer.key_findings,
            evidence=ai_answer.evidence,
            related_exceptions=ai_answer.related_exceptions,
            limitations=ai_answer.limitations,
            metadata={
                "dataset_id": dataset_id,
                "planning_time_ms": plan_duration_ms,
                "execution_time_ms": exec_duration_ms,
                "generation_time_ms": gen_duration_ms,
                "total_time_ms": total_duration_ms,
                "query_plan": plan.model_dump(),
            }
        )

    def _generate_grounded_answer(
        self,
        dataset_id: str,
        question: str,
        plan: QueryPlan,
        data: Dict[str, Any]
    ) -> AskAIAnswer:
        intent = plan.intent

        # 1. Off-Topic
        if intent == AskIntent.OFF_TOPIC:
            return AskAIAnswer(
                answer="I'm here to investigate your merchant financial dataset. Try asking about settlements, payments, refunds, fees, or reconciliation discrepancies.",
                key_findings=["Off-topic request redirected."],
                evidence=[],
                related_exceptions=[],
                limitations=["Only queries relevant to merchant settlement data are supported."]
            )

        # 2. Unsupported
        if intent == AskIntent.UNSUPPORTED_QUESTION:
            return AskAIAnswer(
                answer="I can't determine future forecasts, fraud claims, or non-financial predictions from the current settlement dataset.",
                key_findings=["Requested attributes (future sales/fraud claims) are outside the scope of reconciliation records."],
                evidence=[],
                related_exceptions=[],
                limitations=["Available data is limited to uploaded payments, settlements, refunds, and fee records."]
            )

        # 3. FINANCIAL_DISCREPANCY
        if intent == AskIntent.FINANCIAL_DISCREPANCY:
            recon = data.get("reconciliation") or {}
            exc = data.get("exceptions") or {}
            diff = recon.get("unexplained_difference", recon.get("total_difference", exc.get("total_financial_impact", 0.0)))
            exp_settle = recon.get("total_expected_settlement", 0.0)
            act_settle = recon.get("total_actual_settlement", 0.0)
            total_exc = exc.get("total_exceptions", 0)

            top_contrib = data.get("top_contributors", [])
            top_ids = [t.get("exception_id") for t in top_contrib if t.get("exception_id")]

            return AskAIAnswer(
                answer=f"Your actual settlement credit is ₹{diff:,.2f} below the expected payout amount across {total_exc} identified exceptions.",
                key_findings=[
                    f"Total expected net payout: ₹{exp_settle:,.2f}",
                    f"Actual bank payout credited: ₹{act_settle:,.2f}",
                    f"Net unexplained discrepancy: ₹{diff:,.2f}",
                    f"Total exceptions requiring investigation: {total_exc}"
                ],
                evidence=[
                    EvidenceItem(label="Expected Settlement", value=f"₹{exp_settle:,.2f}"),
                    EvidenceItem(label="Actual Settlement", value=f"₹{act_settle:,.2f}"),
                    EvidenceItem(label="Total Discrepancy", value=f"₹{diff:,.2f}"),
                    EvidenceItem(label="Active Exceptions", value=str(total_exc), link=f"/exceptions?dataset_id={dataset_id}"),
                ],
                related_exceptions=top_ids,
                limitations=["Discrepancies represent potential variances identified via reconciliation rules."]
            )

        # 4. DATASET_SUMMARY
        if intent == AskIntent.DATASET_SUMMARY:
            recon = data.get("reconciliation") or {}
            exc = data.get("exceptions") or {}
            tx_count = recon.get("total_transactions", 0)
            clean_count = recon.get("cleanly_reconciled_count", recon.get("matched_count", 0))
            rate = recon.get("reconciliation_rate_percent", recon.get("reconciliation_rate", 100.0))
            impact = exc.get("total_financial_impact", recon.get("unexplained_difference", 0.0))
            crit_count = exc.get("severity_breakdown", {}).get("CRITICAL", 0)

            return AskAIAnswer(
                answer=f"The current session contains {tx_count:,} transactions with a reconciliation rate of {rate:.1f}%. A total of ₹{impact:,.2f} in potential discrepancies was detected across {exc.get('total_exceptions', 0)} exceptions.",
                key_findings=[
                    f"Total transactions processed: {tx_count:,}",
                    f"Cleanly matched records: {clean_count:,} ({rate:.1f}%)",
                    f"Total potential discrepancy: ₹{impact:,.2f}",
                    f"Critical severity issues: {crit_count}"
                ],
                evidence=[
                    EvidenceItem(label="Total Transactions", value=f"{tx_count:,}", link=f"/transactions?dataset_id={dataset_id}"),
                    EvidenceItem(label="Reconciliation Rate", value=f"{rate:.1f}%"),
                    EvidenceItem(label="Discrepancy Impact", value=f"₹{impact:,.2f}"),
                    EvidenceItem(label="Critical Exceptions", value=str(crit_count), link=f"/exceptions?dataset_id={dataset_id}&severity=CRITICAL"),
                ],
                related_exceptions=[],
                limitations=[]
            )

        # 5. TOP_EXCEPTIONS
        if intent == AskIntent.TOP_EXCEPTIONS:
            items = data.get("items", [])
            findings = []
            ev_items = []
            related_ids = []

            for it in items:
                eid = it.get("exception_id", "")
                pid = it.get("payment_id", "")
                etype = it.get("exception_type", it.get("primary_exception_type", ""))
                amt = it.get("amount_discrepancy", it.get("financial_impact", 0.0))
                findings.append(f"{etype} on {pid or eid}: ₹{amt:,.2f} ({it.get('severity')})")
                related_ids.append(eid)
                ev_items.append(EvidenceItem(
                    label=f"{etype} ({pid or eid})",
                    value=f"₹{amt:,.2f}",
                    link=f"/exceptions/{eid}?dataset_id={dataset_id}",
                    type="EXCEPTION"
                ))

            total_val = sum(it.get("amount_discrepancy", it.get("financial_impact", 0.0)) for it in items)
            return AskAIAnswer(
                answer=f"Identified top {len(items)} prioritized exceptions totaling ₹{total_val:,.2f} in financial impact.",
                key_findings=findings,
                evidence=ev_items,
                related_exceptions=related_ids,
                limitations=["Sorted deterministically by severity priority and discrepancy magnitude."]
            )

        # 6. Specific Types (MISSING, DUPLICATE, AMOUNT_MISMATCH, REFUND, FEE, DELAYED, ORPHAN)
        if intent in [
            AskIntent.MISSING_SETTLEMENTS,
            AskIntent.DUPLICATE_SETTLEMENTS,
            AskIntent.AMOUNT_MISMATCHES,
            AskIntent.REFUND_ISSUES,
            AskIntent.FEE_ISSUES,
            AskIntent.DELAYED_SETTLEMENTS,
            AskIntent.ORPHAN_SETTLEMENTS,
        ]:
            etype = data.get("exception_type", intent.value)
            count = data.get("count", 0)
            impact = data.get("total_impact", 0.0)
            items = data.get("items", [])

            findings = [
                f"Total {etype} count: {count}",
                f"Combined financial impact of sampled items: ₹{impact:,.2f}",
            ]
            ev_items = [
                EvidenceItem(label=f"Total {etype}", value=str(count), link=f"/exceptions?dataset_id={dataset_id}&type={etype}"),
                EvidenceItem(label="Sampled Impact", value=f"₹{impact:,.2f}")
            ]
            related_ids = []

            for it in items[:5]:
                eid = it.get("exception_id", "")
                pid = it.get("payment_id", "")
                related_ids.append(eid)
                ev_items.append(EvidenceItem(
                    label=pid or eid,
                    value=f"₹{it.get('amount_discrepancy', it.get('financial_impact', 0.0)):,.2f}",
                    link=f"/exceptions/{eid}?dataset_id={dataset_id}",
                    type="EXCEPTION"
                ))

            return AskAIAnswer(
                answer=f"Found {count} {etype.replace('_', ' ').title()} exceptions in this dataset.",
                key_findings=findings,
                evidence=ev_items,
                related_exceptions=related_ids,
                limitations=["Inspect exception details to view individual batch timestamps and gateway references."]
            )

        # 7. TRANSACTION_LOOKUP
        if intent == AskIntent.TRANSACTION_LOOKUP:
            if not data.get("found"):
                return AskAIAnswer(
                    answer=data.get("message", "Transaction not found."),
                    key_findings=["No matching payment or order reference was identified in the current dataset session."],
                    evidence=[],
                    related_exceptions=[],
                    limitations=["Verify that the payment ID corresponds to the active dataset session."]
                )

            pay = data.get("payment") or {}
            pid = pay.get("payment_id", "")
            amt = pay.get("amount", "0.00")
            status = pay.get("status", pay.get("payment_status", "UNKNOWN"))
            settlements = data.get("settlements", [])
            exc = data.get("exception")

            # Check if this is a follow-up action request
            is_action_followup = "FOLLOW_UP_ACTION" in plan.extracted_terms or any(w in question.lower() for w in ["check next", "what next", "what to do", "how to resolve"])

            findings = [
                f"Payment ID: {pid} (Order: {pay.get('order_id', 'N/A')})",
                f"Gross Captured Amount: ₹{float(amt):,.2f} ({status})",
                f"Settlement records found: {len(settlements)}",
            ]
            if exc:
                etype = exc.get("exception_type", exc.get("primary_exception_type", ""))
                findings.append(f"Audit Flag: {etype} (Discrepancy: ₹{exc.get('amount_discrepancy', exc.get('financial_impact', 0.0)):,.2f})")

            ev = [
                EvidenceItem(label="Payment ID", value=pid, link=f"/transactions/{pid}?dataset_id={dataset_id}", type="TRANSACTION"),
                EvidenceItem(label="Gross Amount", value=f"₹{float(amt):,.2f}"),
                EvidenceItem(label="Payment Status", value=status),
            ]
            if exc:
                eid = exc.get("exception_id", "")
                etype = exc.get("exception_type", exc.get("primary_exception_type", ""))
                ev.append(EvidenceItem(
                    label="Exception Audit",
                    value=etype,
                    link=f"/exceptions/{eid}?dataset_id={dataset_id}",
                    type="EXCEPTION"
                ))

            if is_action_followup:
                if exc:
                    etype = exc.get("exception_type", exc.get("primary_exception_type", ""))
                    answer_text = f"For transaction {pid} (flagged as {etype}), recommended next steps: 1) Verify gateway settlement batch payout file, 2) Cross-reference refund receipts and contract MDR fees, 3) Open investigation in Action Center."
                else:
                    answer_text = f"Transaction {pid} has already been reconciled cleanly with full settlement credit. No further investigation action is required."
            else:
                if exc:
                    etype = exc.get("exception_type", exc.get("primary_exception_type", ""))
                    diff_amt = exc.get("amount_discrepancy", exc.get("financial_impact", 0.0))
                    answer_text = f"Transaction {pid} was captured for ₹{float(amt):,.2f} ({status}) and is flagged with '{etype}' (Discrepancy: ₹{diff_amt:,.2f})."
                else:
                    answer_text = f"Transaction {pid} was captured for ₹{float(amt):,.2f} ({status}) and reconciled cleanly with zero settlement discrepancies."

            return AskAIAnswer(
                answer=answer_text,
                key_findings=findings,
                evidence=ev,
                related_exceptions=[exc.get("exception_id")] if exc and exc.get("exception_id") else [],
                limitations=[]
            )

        # 8. EXCEPTION_BREAKDOWN
        if intent == AskIntent.EXCEPTION_BREAKDOWN:
            summary = data.get("summary") or {}
            tb = summary.get("type_breakdown", {})
            findings = [f"{k}: {v} records" for k, v in tb.items()]

            ev = [
                EvidenceItem(label=k, value=str(v), link=f"/exceptions?dataset_id={dataset_id}&type={k}", type="EXCEPTION")
                for k, v in tb.items()
            ]

            return AskAIAnswer(
                answer=f"Identified {summary.get('total_exceptions', 0)} exceptions categorized across {len(tb)} discrepancy classes.",
                key_findings=findings,
                evidence=ev,
                related_exceptions=[],
                limitations=[]
            )

        # Fallback
        return AskAIAnswer(
            answer="Here is the financial summary for the current dataset session.",
            key_findings=["Dataset loaded successfully."],
            evidence=[],
            related_exceptions=[],
            limitations=[]
        )

    def _get_conversation_context(self, conversation_id: str) -> List[ChatMessage]:
        return self._messages.get(conversation_id, [])

    async def get_conversation(self, conversation_id: str, dataset_id: str) -> Optional[ConversationHistoryResponse]:
        messages = self._messages.get(conversation_id, [])
        if not messages:
            db = db_manager.get_db()
            if db is not None:
                cursor = db["chat_messages"].find({"conversation_id": conversation_id}, {"_id": 0}).sort("created_at", 1)
                docs = await cursor.to_list(length=None)
                messages = [ChatMessage(**d) for d in docs]
                self._messages[conversation_id] = messages

        if not messages:
            return None

        created = messages[0].created_at
        updated = messages[-1].created_at
        return ConversationHistoryResponse(
            conversation_id=conversation_id,
            dataset_id=dataset_id,
            messages=messages,
            created_at=created,
            updated_at=updated
        )

    async def _persist_messages(self, dataset_id: str, conversation_id: str, messages: List[ChatMessage]):
        if conversation_id not in self._messages:
            self._messages[conversation_id] = []
        self._messages[conversation_id].extend(messages)

        db = db_manager.get_db()
        if db is not None:
            docs = [m.model_dump() for m in messages]
            await db["chat_messages"].insert_many(docs)


ask_service = AskLeakLensService()
