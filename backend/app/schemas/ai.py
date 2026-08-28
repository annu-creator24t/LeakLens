from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class AIInvestigationOutput(BaseModel):
    summary: str = Field(..., description="High-level executive summary of the investigation")
    what_happened: str = Field(..., description="Objective description of the confirmed financial events")
    why_it_matters: str = Field(..., description="Financial and operational impact explanation")
    possible_causes: List[str] = Field(..., description="Plausible hypotheses for why the discrepancy occurred")
    recommended_actions: List[str] = Field(..., description="Safe, non-destructive next steps to investigate")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Evidence completeness confidence score")
    evidence_points: List[str] = Field(..., description="Verified factual evidence points derived directly from records")
    limitations: List[str] = Field(default_factory=list, description="Explicit boundaries and missing data observations")


class AIInvestigationRecord(BaseModel):
    investigation_id: str
    dataset_id: str
    exception_id: str
    provider: str
    model: str
    prompt_version: str
    created_at: str
    generation_time_ms: float
    evidence_hash: str
    investigation: AIInvestigationOutput


class InvestigationRequest(BaseModel):
    force_refresh: bool = False


class InvestigationResponse(BaseModel):
    success: bool
    exception_id: str
    dataset_id: str
    cached: bool = False
    investigation: AIInvestigationOutput
    metadata: Dict[str, Any]
