from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DatasetStatus(str, Enum):
    UPLOADING = "UPLOADING"
    VALIDATING = "VALIDATING"
    READY = "READY"
    RECONCILING = "RECONCILING"
    RECONCILED = "RECONCILED"
    FAILED = "FAILED"


class IssueSeverity(str, Enum):
    WARNING = "WARNING"
    ERROR = "ERROR"


class ColumnMappingItem(BaseModel):
    source_column: str
    target_field: str
    confidence: float = 1.0
    is_required: bool = False
    is_mapped: bool = True
    alternatives: List[str] = Field(default_factory=list)


class FileUploadInfo(BaseModel):
    file_type: str  # payments, settlements, refunds, fees
    original_filename: str
    file_size_bytes: int
    row_count: int
    headers: List[str]
    column_mappings: List[ColumnMappingItem]
    uploaded_at: str
    is_valid: bool = False


class ValidationIssue(BaseModel):
    issue_id: str
    file_type: str
    file_name: Optional[str] = None
    row_number: int
    column: str
    code: str
    severity: IssueSeverity
    message: str
    raw_value: Optional[str] = None
    expected: Optional[str] = None


class FileValidationSummary(BaseModel):
    file_type: str
    total_rows: int = 0
    valid_rows: int = 0
    warning_count: int = 0
    error_count: int = 0
    is_blocking: bool = False
    preview_rows: List[Dict[str, Any]] = Field(default_factory=list)


class UploadSessionState(BaseModel):
    upload_id: str
    status: DatasetStatus = DatasetStatus.UPLOADING
    files: Dict[str, FileUploadInfo] = Field(default_factory=dict)
    validation_summaries: Dict[str, FileValidationSummary] = Field(default_factory=dict)
    issues: List[ValidationIssue] = Field(default_factory=list)
    created_at: str
    updated_at: str
    is_ready_to_confirm: bool = False


class StartUploadResponse(BaseModel):
    success: bool
    upload_id: str
    status: DatasetStatus
    created_at: str


class MappingUpdateRequest(BaseModel):
    file_type: str
    mappings: Dict[str, str]  # source_column -> target_field


class ConfirmDatasetRequest(BaseModel):
    dataset_name: Optional[str] = None
    merchant_id: Optional[str] = "MERCHANT_001"
    timezone: Optional[str] = "UTC"
    currency: Optional[str] = "INR"


class ConfirmDatasetResponse(BaseModel):
    success: bool
    dataset_id: str
    dataset_name: str
    status: DatasetStatus
    reconciliation_summary: Optional[Dict[str, Any]] = None
    exceptions_detected: int = 0
    created_at: str


class DatasetListItem(BaseModel):
    dataset_id: str
    name: str
    source_type: str  # UPLOAD or SYNTHETIC
    status: str
    transaction_count: int = 0
    exception_count: int = 0
    total_volume: float = 0.0
    unexplained_difference: float = 0.0
    created_at: str
    files: List[str] = Field(default_factory=list)
