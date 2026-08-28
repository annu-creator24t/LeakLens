from fastapi import APIRouter, HTTPException, status
from app.schemas.evaluation import EvaluationResponse
from app.services.exception_evaluator import exception_evaluator

router = APIRouter(prefix="/evaluation", tags=["Ground Truth Evaluation Engine"])


@router.post("/run/{dataset_id}", response_model=EvaluationResponse)
async def run_ground_truth_evaluation(dataset_id: str):
    """
    Evaluates detected exceptions against Phase 3 injected ground truth labels.
    Returns honest Precision, Recall, F1 metrics and confusion matrix breakdown.
    """
    try:
        response = await exception_evaluator.evaluate(dataset_id)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ground truth evaluation failed: {str(e)}"
        )
