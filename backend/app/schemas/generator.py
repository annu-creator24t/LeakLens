from typing import Dict, Optional, Any
from pydantic import BaseModel, Field


class AnomalyConfig(BaseModel):
    missing_settlement: bool = True
    duplicate_settlement: bool = True
    amount_mismatch: bool = True
    refund_mismatch: bool = True
    fee_anomaly: bool = True
    delayed_settlement: bool = True
    orphan_settlement: bool = True


class GeneratorConfig(BaseModel):
    transaction_count: int = Field(default=1000, ge=50, le=100000, description="Total transactions (50 to 100,000)")
    anomaly_rate: float = Field(default=0.05, ge=0.0, le=0.20, description="Anomaly rate (0.00 to 0.20)")
    seed: int = Field(default=12345, description="Deterministic pseudo-random generator seed")
    merchant_id: str = Field(default="M001", description="Default primary merchant identifier")
    anomalies: AnomalyConfig = Field(default_factory=AnomalyConfig)


class GeneratorResponse(BaseModel):
    success: bool
    dataset_id: str
    transaction_count: int
    anomaly_count: int
    generation_time_ms: float
    anomaly_breakdown: Dict[str, int] = Field(default_factory=dict)
    files_available: list[str] = Field(default_factory=list)


class DatasetMetadata(BaseModel):
    dataset_id: str
    seed: int
    transaction_count: int
    anomaly_rate: float
    created_at: str
    anomaly_counts: Dict[str, int]
    generation_duration_ms: float
    generator_version: str = "1.0.0"
    merchant_id: str
