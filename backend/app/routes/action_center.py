from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.action_center import (
    InvestigationStatus,
    AuditAction,
    ActionCenterSummary,
    NoteRequest,
    StatusChangeRequest,
    BulkActionRequest,
    BulkActionResponse,
    InvestigationHistoryResponse
)
from app.services.action_center import action_center_service

router = APIRouter(prefix="/action-center", tags=["Investigation Action Center"])


@router.get("/{dataset_id}/summary", response_model=ActionCenterSummary)
async def get_action_center_summary(dataset_id: str):
    """
    Returns real-time counts for Open, Investigating, Resolved, and Ignored issues.
    """
    try:
        return await action_center_service.get_summary(dataset_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch action center summary: {str(e)}"
        )


@router.get("/{dataset_id}/priority")
async def get_priority_queue(
    dataset_id: str,
    status_filter: Optional[str] = Query("OPEN", description="OPEN, INVESTIGATING, RESOLVED, IGNORED, or ALL"),
    severity: Optional[str] = Query(None, description="CRITICAL, HIGH, MEDIUM, LOW"),
    exception_type: Optional[str] = Query(None, description="Filter by exception class"),
    min_impact: Optional[float] = Query(None, description="Minimum discrepancy amount"),
    max_impact: Optional[float] = Query(None, description="Maximum discrepancy amount"),
    search: Optional[str] = Query(None, description="Search payment, order, or exception ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Retrieves prioritized exceptions sorted deterministically by Severity, Impact, and Age.
    """
    try:
        items, total = await action_center_service.get_prioritized_exceptions(
            dataset_id=dataset_id,
            status_filter=status_filter,
            severity_filter=severity,
            type_filter=exception_type,
            min_impact=min_impact,
            max_impact=max_impact,
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch priority queue: {str(e)}"
        )


@router.post("/{dataset_id}/exceptions/{exception_id}/start")
async def start_investigation(
    dataset_id: str,
    exception_id: str,
    payload: Optional[StatusChangeRequest] = None
):
    """
    Transitions exception from OPEN -> INVESTIGATING and records an audit event.
    """
    try:
        actor = payload.actor if payload else "development-user"
        note = payload.note if payload else None
        res = await action_center_service.update_status(
            dataset_id=dataset_id,
            exception_id=exception_id,
            target_status=InvestigationStatus.INVESTIGATING,
            action=AuditAction.INVESTIGATION_STARTED,
            note=note,
            actor=actor
        )
        return {"success": True, "exception": res}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{dataset_id}/exceptions/{exception_id}/note")
async def add_investigation_note(
    dataset_id: str,
    exception_id: str,
    payload: NoteRequest
):
    """
    Adds a persistent investigation note and audit log entry.
    """
    try:
        note_doc = await action_center_service.add_note(
            dataset_id=dataset_id,
            exception_id=exception_id,
            note_text=payload.note,
            actor=payload.actor
        )
        return {"success": True, "note": note_doc}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{dataset_id}/exceptions/{exception_id}/resolve")
async def resolve_exception(
    dataset_id: str,
    exception_id: str,
    payload: StatusChangeRequest
):
    """
    Transitions exception to RESOLVED (requires resolution note).
    """
    if not payload.note or not payload.note.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A resolution note explaining how the issue was addressed is required."
        )

    try:
        res = await action_center_service.update_status(
            dataset_id=dataset_id,
            exception_id=exception_id,
            target_status=InvestigationStatus.RESOLVED,
            action=AuditAction.RESOLVED,
            note=payload.note,
            actor=payload.actor
        )
        return {"success": True, "exception": res}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{dataset_id}/exceptions/{exception_id}/ignore")
async def ignore_exception(
    dataset_id: str,
    exception_id: str,
    payload: StatusChangeRequest
):
    """
    Transitions exception to IGNORED (requires reason note).
    """
    if not payload.note or not payload.note.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A reason note for ignoring this exception is required."
        )

    try:
        res = await action_center_service.update_status(
            dataset_id=dataset_id,
            exception_id=exception_id,
            target_status=InvestigationStatus.IGNORED,
            action=AuditAction.IGNORED,
            note=payload.note,
            actor=payload.actor
        )
        return {"success": True, "exception": res}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{dataset_id}/exceptions/{exception_id}/reopen")
async def reopen_exception(
    dataset_id: str,
    exception_id: str,
    payload: Optional[StatusChangeRequest] = None
):
    """
    Transitions a RESOLVED or IGNORED exception back to OPEN.
    """
    try:
        actor = payload.actor if payload else "development-user"
        note = payload.note if payload else "Issue reopened for investigation."
        res = await action_center_service.update_status(
            dataset_id=dataset_id,
            exception_id=exception_id,
            target_status=InvestigationStatus.OPEN,
            action=AuditAction.REOPENED,
            note=note,
            actor=actor
        )
        return {"success": True, "exception": res}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{dataset_id}/exceptions/{exception_id}/history", response_model=InvestigationHistoryResponse)
async def get_investigation_history(dataset_id: str, exception_id: str):
    """
    Retrieves complete chronological notes and audit events for the exception.
    """
    try:
        return await action_center_service.get_history(dataset_id, exception_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{dataset_id}/bulk", response_model=BulkActionResponse)
async def execute_bulk_action(dataset_id: str, request: BulkActionRequest):
    """
    Executes bulk status transitions with per-item validation and failure reporting.
    """
    try:
        return await action_center_service.execute_bulk_action(dataset_id, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
