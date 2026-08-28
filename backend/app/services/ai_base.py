from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from app.schemas.financial import AIInvestigationResult


class BaseAIService(ABC):
    """
    Abstract AI Provider Interface.
    Decouples the application from any specific LLM provider (OpenAI, Gemini, Groq, Anthropic, or Mock).
    """

    @abstractmethod
    async def investigate_exception(
        self,
        exception_data: Dict[str, Any]
    ) -> AIInvestigationResult:
        """
        Takes structured financial exception evidence and generates an auditable,
        grounded analysis with recommended merchant actions.
        """
        pass

    @abstractmethod
    async def ask_assistant(
        self,
        query: str,
        reconciliation_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Answers natural language merchant questions grounded strictly in the provided
        reconciliation results and transaction evidence.
        """
        pass


class MockAIService(BaseAIService):
    """
    Fallback deterministic mock AI provider for offline development, CI/CD, and testing.
    """

    async def investigate_exception(
        self,
        exception_data: Dict[str, Any]
    ) -> AIInvestigationResult:
        payment_id = exception_data.get("payment_id", "UNKNOWN")
        exc_type = exception_data.get("exception_type", "UNKNOWN")
        diff = exception_data.get("amount_discrepancy", 0.0)

        return AIInvestigationResult(
            what_happened=f"Identified a {exc_type} anomaly on transaction {payment_id} with an unexplained discrepancy of ₹{diff:,.2f}.",
            why_it_matters="Discrepancies in settlement credit impact cash flow predictability and margin reconciliation.",
            possible_explanation=f"Potential gateway settlement delay or batch fee miscalculation for {payment_id}.",
            recommended_action=f"Verify transaction {payment_id} status on payment gateway portal before initiating reconciliation adjustment.",
            confidence=0.94
        )

    async def ask_assistant(
        self,
        query: str,
        reconciliation_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        return {
            "answer": f"Analysis for '{query}': Evaluated current reconciled dataset containing {reconciliation_context.get('total_transactions', 0)} records.",
            "citations": [],
            "confidence": 0.95
        }


def get_ai_service(provider: Optional[str] = None) -> BaseAIService:
    """Factory to retrieve the configured AI provider instance."""
    # Currently defaults to MockAIService. Real LLM providers (Gemini, Groq, OpenAI) will be plugged in here in future phases.
    return MockAIService()
