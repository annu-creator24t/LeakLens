import re
from typing import Optional, Dict, Any, List
from app.schemas.ask import AskIntent, QueryPlan


class QueryPlannerService:
    """
    Parses natural language questions into safe, structured query plans.
    Strictly validates parameters and guards against prompt injection and arbitrary database queries.
    """

    INJECTION_PATTERNS = [
        r"ignore\s+(all\s+)?(previous|prior|system)\s+instructions?",
        r"(show|tell|print|reveal|give|leak|dump)\s+(me\s+)?(your\s+|the\s+)?.*?(password|credential|secret|api[_\s]key|jwt|env|internal|instruction|prompt|system)",
        r"(drop|delete|truncate|insert|update|modify|alter|set|change|mark|overwrite|fake)\s+.*?(table|collection|database|total|amount|balance|exception|status|difference|discrepancy|payout|settlement)",
        r"system\s+prompt",
        r"<script.*?>",
        r"\{\{.*?\}\}",
        r"eval\(",
        r"exec\(",
    ]

    OFF_TOPIC_PATTERNS = [
        r"\b(poem|poetry|joke|story|recipe|weather|song|game|riddle)\b",
        r"\b(who are you|who made you|capital of|translate to|write code for)\b",
    ]

    UNSUPPORTED_KEYWORDS = [
        "next month",
        "future sales",
        "forecast",
        "predict",
        "fraud",
        "will customer pay",
        "who is the customer",
        "customer phone",
        "customer address",
        "chargeback probability",
    ]

    def plan_query(self, question: str, previous_context: Optional[Dict[str, Any]] = None) -> QueryPlan:
        q_lower = question.strip().lower()

        # 1. Prompt Injection Defense Check
        for pat in self.INJECTION_PATTERNS:
            if re.search(pat, q_lower, re.IGNORECASE):
                return QueryPlan(
                    intent=AskIntent.OFF_TOPIC,
                    confidence=1.0,
                    extracted_terms=["SECURITY_GUARD_TRIGGERED"]
                )

        # 2. Off-Topic Check
        for pat in self.OFF_TOPIC_PATTERNS:
            if re.search(pat, q_lower, re.IGNORECASE):
                return QueryPlan(
                    intent=AskIntent.OFF_TOPIC,
                    confidence=1.0,
                    extracted_terms=[pat]
                )

        # 3. Unsupported Future/Fraud/PII Prediction Check
        for kw in self.UNSUPPORTED_KEYWORDS:
            if kw in q_lower:
                return QueryPlan(
                    intent=AskIntent.UNSUPPORTED_QUESTION,
                    confidence=1.0,
                    extracted_terms=[kw]
                )

        # 4. Extract Explicit Identifiers (Payment ID / Order ID) - Must contain digits
        # 4. Extract Explicit Identifiers (Payment ID / Order ID) - Must contain digits
        pid_match = re.search(r"\b((?:pay|txn|ref)[_-]?\d[\w\d\-]*)\b", question, re.IGNORECASE)
        ord_match = re.search(r"\b(ord[_-]?\d[\w\d\-]*)\b", question, re.IGNORECASE)
        
        payment_id = pid_match.group(1).upper() if pid_match else None
        order_id = ord_match.group(1).upper() if ord_match else None

        if payment_id or order_id:
            return QueryPlan(
                intent=AskIntent.TRANSACTION_LOOKUP,
                payment_id=payment_id,
                order_id=order_id,
                confidence=0.95,
                extracted_terms=[payment_id or order_id or ""]
            )

        # Extract limit (e.g. "top 5", "top 10", "3 biggest")
        limit = 5
        limit_match = re.search(r"\b(top|first|biggest|highest)\s+(\d{1,2})\b", q_lower)
        if limit_match:
            limit = min(20, max(1, int(limit_match.group(2))))

        # Extract severity if present
        severity = None
        if "critical" in q_lower:
            severity = "CRITICAL"
        elif "high" in q_lower:
            severity = "HIGH"

        # 5. Follow-Up Resolution using Context
        if previous_context:
            prev_pid = previous_context.get("payment_id")
            prev_intent = previous_context.get("intent")
            if prev_pid and ("next" in q_lower or "what should i check" in q_lower or "how to fix" in q_lower or "how to resolve" in q_lower or "what to do" in q_lower):
                return QueryPlan(
                    intent=AskIntent.TRANSACTION_LOOKUP,
                    payment_id=prev_pid,
                    confidence=0.95,
                    extracted_terms=[prev_pid, "FOLLOW_UP_ACTION"]
                )
            if "the biggest" in q_lower or "the first one" in q_lower or "why is it" in q_lower:
                if prev_intent in [AskIntent.TOP_EXCEPTIONS, AskIntent.FINANCIAL_DISCREPANCY, AskIntent.MISSING_SETTLEMENTS]:
                    return QueryPlan(
                        intent=AskIntent.TOP_EXCEPTIONS,
                        limit=1,
                        sort_by="financial_impact",
                        order="desc",
                        confidence=0.92
                    )

        # 6. Intent Classification Rules
        # A. Missing Settlements
        if ("missing settlement" in q_lower or "haven't settled" in q_lower or "have not been settled" in q_lower or
            "not settled" in q_lower or "unsettled" in q_lower or "no settlement" in q_lower):
            return QueryPlan(
                intent=AskIntent.MISSING_SETTLEMENTS,
                severity=severity,
                limit=limit,
                confidence=0.95
            )

        # B. Duplicate Settlements
        if "duplicate" in q_lower or "double settlement" in q_lower or "credited twice" in q_lower:
            return QueryPlan(
                intent=AskIntent.DUPLICATE_SETTLEMENTS,
                severity=severity,
                limit=limit,
                confidence=0.95
            )

        # C. Refund Issues
        if "refund" in q_lower:
            return QueryPlan(
                intent=AskIntent.REFUND_ISSUES,
                severity=severity,
                limit=limit,
                confidence=0.95
            )

        # D. Fee Issues
        if "fee" in q_lower or "mdr" in q_lower or "surcharge" in q_lower or "processing cost" in q_lower:
            return QueryPlan(
                intent=AskIntent.FEE_ISSUES,
                severity=severity,
                limit=limit,
                confidence=0.95
            )

        # E. Amount Mismatch Issues
        if "amount mismatch" in q_lower or "payout mismatch" in q_lower or "settlement mismatch" in q_lower or "mismatch" in q_lower:
            return QueryPlan(
                intent=AskIntent.AMOUNT_MISMATCHES,
                severity=severity,
                limit=limit,
                confidence=0.95
            )

        # F. Delayed Settlements
        if "delay" in q_lower or "sla" in q_lower or "late settlement" in q_lower or "took too long" in q_lower:
            return QueryPlan(
                intent=AskIntent.DELAYED_SETTLEMENTS,
                severity=severity,
                limit=limit,
                confidence=0.95
            )

        # G. Orphan Settlements
        if "orphan" in q_lower or "unknown payment" in q_lower or "unmatched settlement" in q_lower:
            return QueryPlan(
                intent=AskIntent.ORPHAN_SETTLEMENTS,
                severity=severity,
                limit=limit,
                confidence=0.95
            )

        # H. Top Exceptions & Priority Queue
        if ("top" in q_lower or "biggest" in q_lower or "highest" in q_lower or "worst" in q_lower or
            "most important" in q_lower or "priority" in q_lower or "should i investigate" in q_lower or
            ("critical" in q_lower and "exception" in q_lower)):
            return QueryPlan(
                intent=AskIntent.TOP_EXCEPTIONS,
                severity=severity or "CRITICAL",
                limit=limit,
                sort_by="financial_impact",
                order="desc",
                confidence=0.95
            )

        # I. Financial Discrepancy / Money Unexplained
        if ("unexplained" in q_lower or "money" in q_lower or "discrepancy" in q_lower or
            "lower than expected" in q_lower or "at risk" in q_lower or "variance" in q_lower or
            ("how much" in q_lower and ("leak" in q_lower or "gap" in q_lower or "lost" in q_lower))):
            return QueryPlan(
                intent=AskIntent.FINANCIAL_DISCREPANCY,
                confidence=0.95
            )

        # H. Exception Breakdown
        if ("breakdown" in q_lower or "how many exception" in q_lower or "how many critical" in q_lower or
            "which exception type" in q_lower or "types of issues" in q_lower or "categories" in q_lower):
            return QueryPlan(
                intent=AskIntent.EXCEPTION_BREAKDOWN,
                confidence=0.95
            )

        # I. Dataset Summary / Overview
        if ("summary" in q_lower or "overview" in q_lower or "health" in q_lower or "total transaction" in q_lower or
            "how many transaction" in q_lower or "how much did i process" in q_lower or "volume" in q_lower or
            "reconciliation rate" in q_lower or "match rate" in q_lower):
            return QueryPlan(
                intent=AskIntent.DATASET_SUMMARY,
                confidence=0.95
            )

        # Default fallback: Financial Discrepancy & Summary
        return QueryPlan(
            intent=AskIntent.DATASET_SUMMARY,
            confidence=0.75
        )


query_planner = QueryPlannerService()
