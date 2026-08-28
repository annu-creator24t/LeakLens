from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class InvestigationStatus(str, Enum):
    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    IGNORED = "IGNORED"


class AuditAction(str, Enum):
    INVESTIGATION_STARTED = "INVESTIGATION_STARTED"
    NOTE_ADDED = "NOTE_ADDED"
    RESOLVED = "RESOLVED"
    IGNORED = "IGNORED"
    REOPENED = "REOPENED"


class InvestigationNote(BaseModel):
    note_id: str
    dataset_id: str
    exception_id: str
    note: str
    actor: str = "development-user"
    created_at: str


class InvestigationAuditEvent(BaseModel):
    audit_id: str
    dataset_id: str
    exception_id: str
    action: AuditAction
    previous_status: InvestigationStatus
    new_status: InvestigationStatus
    note: Optional[str] = None
    actor: str = "development-user"
    created_at: str


class ActionCenterSummary(BaseModel):
    open: int = 0
    investigating: int = 0
    resolved: int = 0
    ignored: int = 0
    total: int = 0
    total_unresolved_impact: float = 0.0


class NoteRequest(BaseModel):
    note: str = Field(..., min_length=1, max_length=2000, description="Investigation note text")
    actor: str = "development-user"


class StatusChangeRequest(BaseModel):
    note: Optional[str] = None
    actor: str = "development-user"


class BulkActionRequest(BaseModel):
    exception_ids: List[str] = Field(..., min_length=1, max_length=100)
    action: str = Field(..., description="START or IGNORE")
    note: Optional[str] = None
    actor: str = "development-user"


class BulkActionResponse(BaseModel):
    success: bool
    total_requested: int
    updated_count: int
    skipped_count: int
    updated_ids: List[str]
    skipped_reasons: Dict[str, str]


class InvestigationHistoryResponse(BaseModel):
    exception_id: str
    dataset_id: str
    current_status: InvestigationStatus
    notes: List[InvestigationNote]
    audit_events: List[InvestigationAuditEvent]
