from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.reconciliation import (
    ReconcileRequest,
    ReconcileResponse,
    ExceptionDetailResponse,
)
from app.schemas.financial import ExceptionType, SeverityLevel
from app.services.reconciliation_engine import reconciliation_engine

router = APIRouter(prefix="/reconciliation", tags=["Deterministic Reconciliation Engine"])


@router.post("/run", response_model=ReconcileResponse)
async def run_reconciliation(payload: ReconcileRequest):
    """
    Triggers deterministic financial reconciliation across payments, settlements, refunds, and fees.
    """
    try:
        response = await reconciliation_engine.reconcile(payload.dataset_id)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reconciliation run failed: {str(e)}"
        )


@router.get("/{dataset_id}/summary", response_model=Dict[str, Any])
async def get_reconciliation_summary(dataset_id: str):
    """
    Retrieves the high-level reconciliation summary and discrepancy totals.
    """
    summary = await reconciliation_engine.get_summary(dataset_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reconciliation summary for dataset '{dataset_id}' not found. Please run reconciliation first."
        )
    return summary


@router.get("/{dataset_id}/exceptions")
async def get_reconciliation_exceptions(
    dataset_id: str,
    severity: Optional[SeverityLevel] = Query(None, description="Filter by severity level"),
    exception_type: Optional[ExceptionType] = Query(None, description="Filter by exception type"),
    search: Optional[str] = Query(None, description="Search by payment ID or description"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Items per page")
):
    """
    Queries detected reconciliation exceptions with filtering, search, and pagination.
    """
    items, total = await reconciliation_engine.get_exceptions(
        dataset_id=dataset_id,
        severity=severity,
        exception_type=exception_type,
        search=search,
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


@router.get("/{dataset_id}/exceptions/{exception_id}", response_model=ExceptionDetailResponse)
async def get_exception_detail(dataset_id: str, exception_id: str):
    """
    Retrieves full transaction lifecycle timeline, mathematical evidence, and audit breakdown for an individual exception.
    """
    exc = await reconciliation_engine.get_exception_detail(dataset_id, exception_id)
    if not exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exception '{exception_id}' not found in dataset '{dataset_id}'."
        )
    return exc
