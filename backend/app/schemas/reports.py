from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ReportFilterParams(BaseModel):
    severity: Optional[str] = None
    exception_type: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    date_preset: Optional[str] = "ALL"  # ALL, TODAY, LAST_7_DAYS, LAST_30_DAYS, CUSTOM


class ReportMetadata(BaseModel):
    report_id: str
    dataset_id: str
    report_title: str = "Financial Reconciliation & Investigation Report"
    report_type: str = "PDF"  # PDF, JSON
    report_version: str = "v1.0"
    filters: ReportFilterParams = Field(default_factory=ReportFilterParams)
    created_at: str
    generation_time_ms: float = 0.0
    download_url: str


class ReportGenerateRequest(BaseModel):
    format: str = "pdf"  # pdf, json
    filters: Optional[ReportFilterParams] = None


class ReportGenerateResponse(BaseModel):
    success: bool
    report_id: str
    download_url: str
    generation_time_ms: float
    metadata: ReportMetadata


class ReportPreviewResponse(BaseModel):
    dataset_id: str
    generated_at: str
    report_version: str = "v1.0"
    filters: ReportFilterParams
    financial_overview: Dict[str, Any]
    exception_summary: Dict[str, Any]
    severity_breakdown: Dict[str, int]
    top_issues: List[Dict[str, Any]]
    investigation_status: Dict[str, Any]
    investigation_activity: Dict[str, int]
    ai_insights: List[Dict[str, Any]]
    methodology: str


class ReportHistoryListResponse(BaseModel):
    dataset_id: str
    reports: List[ReportMetadata]
