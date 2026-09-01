from enum import Enum
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class PaymentStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PENDING = "PENDING"
    CANCELLED = "CANCELLED"


class SettlementStatus(str, Enum):
    SETTLED = "SETTLED"
    PENDING = "PENDING"
    FAILED = "FAILED"


class RefundStatus(str, Enum):
    PROCESSED = "PROCESSED"
    COMPLETED = "COMPLETED"
    REFUNDED = "REFUNDED"
    PENDING = "PENDING"
    FAILED = "FAILED"


class ExceptionType(str, Enum):
    MISSING_SETTLEMENT = "MISSING_SETTLEMENT"
    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    DUPLICATE_SETTLEMENT = "DUPLICATE_SETTLEMENT"
    REFUND_MISMATCH = "REFUND_MISMATCH"
    UNEXPECTED_FEE = "UNEXPECTED_FEE"
    DELAYED_SETTLEMENT = "DELAYED_SETTLEMENT"
    ORPHAN_SETTLEMENT = "ORPHAN_SETTLEMENT"


class SeverityLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


# --- Core Raw Record Schemas ---

class Payment(BaseModel):
    payment_id: str
    order_id: str
    merchant_id: str
    amount: float
    currency: str = "INR"
    payment_status: PaymentStatus
    payment_method: Optional[str] = None
    created_at: datetime


class Settlement(BaseModel):
    settlement_id: str
    payment_id: str
    settlement_amount: float
    settlement_status: SettlementStatus = SettlementStatus.SETTLED
    settlement_date: datetime


class Refund(BaseModel):
    refund_id: str
    payment_id: str
    refund_amount: float
    refund_status: RefundStatus = RefundStatus.PROCESSED
    refund_date: datetime


class Fee(BaseModel):
    payment_id: str
    fee_amount: float
    tax_amount: float = 0.0


# --- AI Investigation Payload Schema ---

class AIInvestigationResult(BaseModel):
    what_happened: str
    why_it_matters: str
    possible_explanation: str
    recommended_action: str
    confidence: float = Field(ge=0.0, le=1.0)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# --- Reconciled Exception Schema ---

class ReconciliationException(BaseModel):
    exception_id: str
    payment_id: Optional[str] = None
    exception_type: ExceptionType
    severity: SeverityLevel
    amount_discrepancy: float
    expected_settlement: float
    actual_settlement: float
    evidence: Dict[str, Any] = Field(default_factory=dict)
    ai_investigation: Optional[AIInvestigationResult] = None
    status: str = "OPEN"  # OPEN, UNDER_REVIEW, RESOLVED
    created_at: datetime = Field(default_factory=datetime.utcnow)


# --- Summary Overview Schema ---

class ReconciliationSummary(BaseModel):
    total_transactions: int = 0
    matched_count: int = 0
    exception_count: int = 0
    total_volume: float = 0.0
    expected_settlement: float = 0.0
    actual_settlement: float = 0.0
    unexplained_difference: float = 0.0
    reconciliation_rate: float = 0.0
