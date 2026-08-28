from typing import Dict, Any
from pydantic import BaseModel, Field


class MetricItem(BaseModel):
    tp: int
    fp: int
    fn: int
    precision: float
    recall: float
    f1: float


class OverallMetrics(BaseModel):
    total_tp: int
    total_fp: int
    total_fn: int
    precision: float
    recall: float
    f1: float
    macro_precision: float
    macro_recall: float
    macro_f1: float


class EvaluationResponse(BaseModel):
    success: bool
    dataset_id: str
    total_ground_truth: int
    total_detected: int
    overall: OverallMetrics
    by_type: Dict[str, MetricItem]
    evaluation_time_ms: float
