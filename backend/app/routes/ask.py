from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from app.schemas.ask import AskRequest, AskResponse, ConversationHistoryResponse
from app.services.ask_leaklens import ask_service

router = APIRouter(prefix="/ask", tags=["Ask LeakLens"])


SUGGESTED_QUESTIONS = [
    "How much money is currently unexplained?",
    "Why is today's settlement lower than expected?",
    "Show me my top 5 discrepancies.",
    "Which payments haven't settled?",
    "How many critical issues do I have?",
    "Which exception type has the highest financial impact?",
]


@router.post("/{dataset_id}", response_model=AskResponse)
async def ask_question(dataset_id: str, request: AskRequest):
    """
    Asks a natural language financial question grounded exclusively in the selected dataset.
    """
    try:
        res = await ask_service.ask(dataset_id=dataset_id, request=request)
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ask LeakLens failed: {str(e)}"
        )


@router.get("/{dataset_id}/conversations/{conversation_id}", response_model=ConversationHistoryResponse)
async def get_conversation_history(dataset_id: str, conversation_id: str):
    """
    Retrieves stored messages and metadata for a conversation thread.
    """
    history = await ask_service.get_conversation(conversation_id=conversation_id, dataset_id=dataset_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found."
        )
    return history


@router.get("/{dataset_id}/suggestions")
async def get_suggested_questions(dataset_id: str):
    """
    Returns curated financial questions for quick investigation.
    """
    return {
        "dataset_id": dataset_id,
        "suggestions": SUGGESTED_QUESTIONS
    }
