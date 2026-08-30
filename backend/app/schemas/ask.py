from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class AskIntent(str, Enum):
    DATASET_SUMMARY = "DATASET_SUMMARY"
    FINANCIAL_DISCREPANCY = "FINANCIAL_DISCREPANCY"
    EXCEPTION_BREAKDOWN = "EXCEPTION_BREAKDOWN"
    TOP_EXCEPTIONS = "TOP_EXCEPTIONS"
    MISSING_SETTLEMENTS = "MISSING_SETTLEMENTS"
    DUPLICATE_SETTLEMENTS = "DUPLICATE_SETTLEMENTS"
    AMOUNT_MISMATCHES = "AMOUNT_MISMATCHES"
    REFUND_ISSUES = "REFUND_ISSUES"
    FEE_ISSUES = "FEE_ISSUES"
    DELAYED_SETTLEMENTS = "DELAYED_SETTLEMENTS"
    ORPHAN_SETTLEMENTS = "ORPHAN_SETTLEMENTS"
    TRANSACTION_LOOKUP = "TRANSACTION_LOOKUP"
    UNSUPPORTED_QUESTION = "UNSUPPORTED_QUESTION"
    OFF_TOPIC = "OFF_TOPIC"


class QueryPlan(BaseModel):
    intent: AskIntent
    confidence: float = 1.0
    payment_id: Optional[str] = None
    order_id: Optional[str] = None
    exception_type: Optional[str] = None
    severity: Optional[str] = None
    limit: int = Field(default=5, ge=1, le=20)
    sort_by: str = "financial_impact"
    order: str = "desc"
    date_filter: Optional[str] = None
    extracted_terms: List[str] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    label: str
    value: str
    link: Optional[str] = None
    type: str = "METRIC"  # METRIC, TRANSACTION, EXCEPTION


class AskAIAnswer(BaseModel):
    answer: str
    key_findings: List[str] = Field(default_factory=list)
    evidence: List[EvidenceItem] = Field(default_factory=list)
    related_exceptions: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)


class AskRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None


class AskResponse(BaseModel):
    success: bool
    conversation_id: str
    question: str
    intent: AskIntent
    answer: str
    key_findings: List[str]
    evidence: List[EvidenceItem]
    related_exceptions: List[str]
    limitations: List[str]
    metadata: Dict[str, Any]


class ChatMessage(BaseModel):
    message_id: str
    conversation_id: str
    role: str  # user | assistant
    content: str
    intent: Optional[AskIntent] = None
    query_plan: Optional[Dict[str, Any]] = None
    evidence: Optional[List[EvidenceItem]] = None
    created_at: str


class ConversationHistoryResponse(BaseModel):
    conversation_id: str
    dataset_id: str
    messages: List[ChatMessage]
    created_at: str
    updated_at: str
