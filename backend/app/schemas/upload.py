from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ValidationErrorItem(BaseModel):
    row: int
    field: Optional[str] = None
    code: str
    message: str
    raw_value: Optional[str] = None


class ValidationSummary(BaseModel):
    total_rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0


class UploadResponse(BaseModel):
    success: bool
    file_type: str
    dataset_id: str
    summary: ValidationSummary
    errors: List[ValidationErrorItem] = Field(default_factory=list)
    warnings: List[ValidationErrorItem] = Field(default_factory=list)


class DatasetUploadStatus(BaseModel):
    dataset_id: str
    created_at: str
    updated_at: str
    uploaded_files: List[str] = Field(default_factory=list)
    file_summaries: Dict[str, Any] = Field(default_factory=dict)
    status: str = "IN_PROGRESS"  # IN_PROGRESS, VALIDATED, FAILED
