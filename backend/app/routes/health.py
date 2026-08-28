from fastapi import APIRouter
from typing import Dict

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=Dict[str, str])
async def health_check():
    """
    Health check endpoint to verify backend operational readiness.
    """
    return {
        "status": "ok",
        "service": "leaklens-backend"
    }
