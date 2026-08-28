from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.ai import InvestigationRequest, InvestigationResponse
from app.services.ai_investigator import ai_investigator

router = APIRouter(prefix="/ai", tags=["AI Exception Investigator"])


@router.post("/investigate/{dataset_id}/{exception_id}", response_model=InvestigationResponse)
async def run_ai_investigation(
    dataset_id: str,
    exception_id: str,
    force_refresh: bool = Query(False, description="Force re-generation bypassing evidence cache")
):
    """
    Executes an evidence-grounded AI investigation for a specific reconciliation exception.
    Relying exclusively on structured evidence and deterministic settlement rules.
    """
    try:
        res = await ai_investigator.investigate_exception(
            dataset_id=dataset_id,
            exception_id=exception_id,
            force_refresh=force_refresh
        )
        return res
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Investigation failed: {str(e)}"
        )


@router.get("/investigate/{dataset_id}/{exception_id}", response_model=InvestigationResponse)
async def get_ai_investigation(dataset_id: str, exception_id: str):
    """
    Retrieves the most recent stored AI investigation record for the exception.
    """
    cached = await ai_investigator.get_stored_investigation(dataset_id, exception_id)
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No AI investigation found for exception '{exception_id}'. Click 'Investigate with AI' to generate one."
        )

    return InvestigationResponse(
        success=True,
        exception_id=exception_id,
        dataset_id=dataset_id,
        cached=True,
        investigation=cached.investigation,
        metadata={
            "investigation_id": cached.investigation_id,
            "provider": cached.provider,
            "model": cached.model,
            "prompt_version": cached.prompt_version,
            "created_at": cached.created_at,
            "generation_time_ms": cached.generation_time_ms,
            "evidence_hash": cached.evidence_hash,
        }
    )
