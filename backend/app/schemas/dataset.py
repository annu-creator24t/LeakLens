from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DatasetSessionCreate(BaseModel):
    merchant_id: Optional[str] = "merchant_default"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DatasetSession(BaseModel):
    dataset_id: str
    merchant_id: Optional[str] = "merchant_default"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    uploaded_files: List[str] = Field(default_factory=list)
    file_summaries: Dict[str, Any] = Field(default_factory=dict)
    status: str = "IN_PROGRESS"  # IN_PROGRESS, VALIDATED, FAILED
