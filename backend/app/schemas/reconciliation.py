from decimal import Decimal
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.financial import ExceptionType, SeverityLevel


class ReconcileRequest(BaseModel):
    dataset_id: str = Field(..., description="Dataset session identifier to reconcile")


class ExceptionSummaryItem(BaseModel):
    type: ExceptionType
    count: int
    total_discrepancy: float


class ReconcileResponse(BaseModel):
    success: bool
    dataset_id: str
    total_transactions: int
    matched_count: int
    exception_count: int
    total_volume: float
    expected_settlement: float
    actual_settlement: float
    unexplained_difference: float
    reconciliation_rate: float
    duration_ms: float
    exception_breakdown: Dict[str, int]
    severity_breakdown: Dict[str, int]


class ExceptionFilterParams(BaseModel):
    severity: Optional[SeverityLevel] = None
    exception_type: Optional[ExceptionType] = None
    search: Optional[str] = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=50, ge=1, le=500)


class ExceptionDetailResponse(BaseModel):
    exception_id: str
    dataset_id: str
    payment_id: Optional[str] = None
    exception_type: ExceptionType
    severity: SeverityLevel
    amount_discrepancy: float
    expected_settlement: float
    actual_settlement: float
    status: str
    description: str
    evidence: Dict[str, Any]
    timeline: List[Dict[str, Any]]
    created_at: str
