from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.exceptions import DetectionResponse, ExceptionSummary, DetectedException
from app.services.exception_detector import exception_detector

router = APIRouter(prefix="/exceptions", tags=["Exception Detection Engine"])


@router.post("/detect/{dataset_id}", response_model=DetectionResponse)
async def run_exception_detection(dataset_id: str):
    """
    Executes deterministic financial exception detection, assigning severity, impact, and structured evidence.
    """
    try:
        res = await exception_detector.detect_exceptions(dataset_id)
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Exception detection failed: {str(e)}"
        )


@router.get("/{dataset_id}/summary", response_model=ExceptionSummary)
async def get_exception_summary(dataset_id: str):
    """
    Retrieves high-level counts and financial impact breakdown by exception category.
    """
    summary = await exception_detector.get_summary(dataset_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exception summary for dataset '{dataset_id}' not found. Please run detection first."
        )
    return summary


@router.get("/{dataset_id}")
async def get_detected_exceptions(
    dataset_id: str,
    exception_type: Optional[str] = Query(None, description="Filter by exception type"),
    severity: Optional[str] = Query(None, description="Filter by severity level"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (OPEN/INVESTIGATING/RESOLVED/IGNORED)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Items per page")
):
    """
    Retrieves paginated detected exception records with optional filtering.
    """
    items, total = await exception_detector.get_exceptions(
        dataset_id=dataset_id,
        severity=severity,
        exception_type=exception_type,
        status=status_filter,
        page=page,
        limit=limit
    )

    return {
        "dataset_id": dataset_id,
        "total": total,
        "page": page,
        "limit": limit,
        "items": items
    }


@router.get("/{dataset_id}/{exception_id}")
async def get_exception_detail(dataset_id: str, exception_id: str):
    """
    Retrieves full evidence packet and machine-readable calculation details for a single exception.
    """
    exc = await exception_detector.get_exception_detail(dataset_id, exception_id)
    if not exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exception '{exception_id}' not found in dataset '{dataset_id}'."
        )
    return exc
