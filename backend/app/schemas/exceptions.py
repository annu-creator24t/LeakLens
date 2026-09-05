from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.financial import ExceptionType, SeverityLevel


class ExceptionEvidence(BaseModel):
    payment: Optional[Dict[str, Any]] = None
    refunds: List[Dict[str, Any]] = Field(default_factory=list)
    fees: Optional[Dict[str, Any]] = None
    settlements: List[Dict[str, Any]] = Field(default_factory=list)
    calculation: Dict[str, Any] = Field(default_factory=dict)
    rule: Dict[str, Any] = Field(default_factory=dict)


class DetectedException(BaseModel):
    exception_id: str
    dataset_id: str
    payment_id: Optional[str] = None
    order_id: Optional[str] = None
    primary_exception_type: str
    exception_type: Optional[str] = None
    severity: str
    status: str = "OPEN"
    financial_impact: float = 0.0
    difference: float = 0.0
    amount_discrepancy: Optional[float] = None
    expected_settlement: Optional[float] = None
    actual_settlement: Optional[float] = None
    confidence: float = 1.0  # Deterministic rule confidence = 100%
    detected_at: str = ""
    created_at: Optional[str] = None
    secondary_signals: List[str] = Field(default_factory=list)
    description: str = ""
    evidence: Dict[str, Any] = Field(default_factory=dict)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)


class ExceptionSummary(BaseModel):
    dataset_id: str
    total_exceptions: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int

    # Breakdown by category
    missing_settlement_count: int = 0
    duplicate_settlement_count: int = 0
    amount_mismatch_count: int = 0
    refund_mismatch_count: int = 0
    fee_anomaly_count: int = 0
    delayed_settlement_count: int = 0
    orphan_settlement_count: int = 0

    # Financial Impact Breakdown
    total_financial_impact: float = 0.0
    missing_settlement_impact: float = 0.0
    duplicate_settlement_impact: float = 0.0
    amount_mismatch_impact: float = 0.0
    refund_mismatch_impact: float = 0.0
    fee_anomaly_impact: float = 0.0
    delayed_settlement_impact: float = 0.0
    orphan_settlement_impact: float = 0.0


class DetectionResponse(BaseModel):
    success: bool
    dataset_id: str
    exceptions_detected: int
    summary: ExceptionSummary
