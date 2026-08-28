import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from app.schemas.ai import AIInvestigationOutput
from app.schemas.financial import AIInvestigationResult
from app.config.settings import settings
from app.utils.prompts import INVESTIGATION_SYSTEM_PROMPT, build_investigation_prompt

logger = logging.getLogger(__name__)


class BaseAIService(ABC):
    """
    Abstract AI Provider Interface.
    Decouples the application from specific LLM vendors (Groq, Gemini, OpenAI, or Mock).
    """
    provider_name: str = "base"
    model_name: str = "base-model"

    @abstractmethod
    async def investigate(
        self,
        evidence: Dict[str, Any],
        exception_type: str,
        severity: str
    ) -> AIInvestigationOutput:
        """
        Takes structured financial evidence and generates a validated, evidence-grounded investigation.
        """
        pass

    # Legacy support
    async def investigate_exception(self, exception_data: Dict[str, Any]) -> AIInvestigationResult:
        ev = exception_data.get("evidence", {})
        t = exception_data.get("exception_type", "UNKNOWN")
        s = exception_data.get("severity", "HIGH")
        out = await self.investigate(ev, t, s)
        return AIInvestigationResult(
            what_happened=out.what_happened,
            why_it_matters=out.why_it_matters,
            possible_explanation=out.possible_causes[0] if out.possible_causes else "",
            recommended_action=out.recommended_actions[0] if out.recommended_actions else "",
            confidence=out.confidence
        )

    async def ask_assistant(self, query: str, reconciliation_context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "answer": f"Analysis for '{query}': Evaluated current reconciled dataset containing {reconciliation_context.get('total_transactions', 0)} records.",
            "citations": [],
            "confidence": 0.95
        }


class MockAIService(BaseAIService):
    """
    Deterministic, evidence-grounded Mock AI provider for testing and offline development.
    Produces high-fidelity, auditable investigations strictly derived from the structured evidence.
    """
    provider_name: str = "mock"
    model_name: str = "mock-financial-investigator-v1"

    async def investigate(
        self,
        evidence: Dict[str, Any],
        exception_type: str,
        severity: str
    ) -> AIInvestigationOutput:
        calc = evidence.get("calculation", {})
        pay = evidence.get("payment") or {}
        details = evidence.get("details", {})
        
        pid = pay.get("payment_id") or details.get("unknown_payment_id") or "UNKNOWN_PAYMENT"
        amt = pay.get("amount") or details.get("orphan_amount") or "0.00"
        expected = calc.get("expected_settlement") or "0.00"
        actual = calc.get("actual_settlement") or "0.00"
        diff = calc.get("difference") or details.get("excess_amount") or details.get("fee_difference") or "0.00"
        settlements = evidence.get("settlements", [])
        refunds = evidence.get("refunds", [])
        fees = evidence.get("fees") or {}

        # 1. Missing Settlement
        if exception_type == "MISSING_SETTLEMENT":
            return AIInvestigationOutput(
                summary=f"Payment {pid} of ₹{amt} was successfully captured, but no settlement credit was issued by the gateway.",
                what_happened=f"Payment {pid} (Order: {pay.get('order_id', 'N/A')}) succeeded on {pay.get('created_at', 'N/A')}, yielding an expected net settlement of ₹{expected}. However, 0 corresponding settlement batch records were found.",
                why_it_matters=f"Creates an uncredited financial discrepancy of ₹{expected}. The merchant has fulfilled the customer order but bank funds have not been deposited.",
                possible_causes=[
                    "Gateway settlement batch processing delay exceeding normal SLA.",
                    "Payment was captured but dropped during payout batch generation.",
                    "Merchant account payout hold or rolling reserve withholding."
                ],
                recommended_actions=[
                    f"Check payout status for payment ID {pid} directly on the payment aggregator portal.",
                    "Cross-reference gateway batch settlement report for the capture date.",
                    "Raise a payout inquiry ticket with aggregator support referencing payment ID."
                ],
                confidence=0.96,
                evidence_points=[
                    f"Payment {pid} status is confirmed SUCCESS ({pay.get('currency', 'INR')} {amt})",
                    f"Settlement records found: {len(settlements)}",
                    f"Deterministic expected payout calculated: ₹{expected}",
                    f"Actual bank payout credited: ₹{actual}"
                ],
                limitations=["Gateway internal batch logs are not accessible via standard export files."]
            )

        # 2. Duplicate Settlement
        elif exception_type == "DUPLICATE_SETTLEMENT":
            sids = details.get("settlement_ids", [s.get("settlement_id") for s in settlements])
            return AIInvestigationOutput(
                summary=f"Payment {pid} has been credited across multiple settlement batches ({', '.join(sids)}), creating an excess payout of ₹{diff}.",
                what_happened=f"The payments ledger contains a single payment of ₹{amt}, but {len(settlements)} distinct settlement records were credited totaling ₹{actual} against an expected net payout of ₹{expected}.",
                why_it_matters=f"The merchant received an unearned excess credit of ₹{diff}, which is vulnerable to unannounced gateway clawbacks or debit adjustments.",
                possible_causes=[
                    "Payment gateway duplicate batch payout execution.",
                    "Multiple settlement attempts following a network timeout retry.",
                    "Re-settlement of previously disputed transaction without ledger linkage."
                ],
                recommended_actions=[
                    f"Verify settlement batch IDs {', '.join(sids)} on the bank statement.",
                    "Notify payment aggregator finance team to clarify excess payout before clawback.",
                    "Set aside ₹" + str(diff) + " in operational reserve for inevitable gateway debit adjustment."
                ],
                confidence=0.98,
                evidence_points=[
                    f"Payment ID {pid} gross captured amount: ₹{amt}",
                    f"Total settlement records mapped: {len(settlements)}",
                    f"Sum of settlement credits: ₹{actual}",
                    f"Excess unearned payout: ₹{diff}"
                ],
                limitations=["Cannot verify if merchant bank has already applied a manual reversal without bank feed data."]
            )

        # 3. Amount Mismatch
        elif exception_type == "AMOUNT_MISMATCH":
            pct = details.get("percentage_difference", 0.0)
            return AIInvestigationOutput(
                summary=f"Settlement payout of ₹{actual} for payment {pid} deviates from expected net settlement of ₹{expected} by ₹{diff}.",
                what_happened=f"For payment {pid} (Amount: ₹{amt}), expected net settlement after standard deductions is ₹{expected}, but actual settlement amount credited was ₹{actual} (Variance: {pct}%).",
                why_it_matters=f"Represents an unexplained financial variance of ₹{diff} affecting gross margin predictability.",
                possible_causes=[
                    "Uncontracted gateway deduction or surcharge applied at settlement time.",
                    "Partial chargeback fee or dispute levy not explicitly reported in fees file.",
                    "Currency conversion spread or rounding variance."
                ],
                recommended_actions=[
                    f"Download detailed transaction fee breakdown for {pid} from the provider portal.",
                    "Confirm if special MDR surcharges or international card fees applied to this card tier.",
                    "Audit fee ledger to identify missing fee line items."
                ],
                confidence=0.94,
                evidence_points=[
                    f"Payment {pid} capture amount: ₹{amt}",
                    f"Expected settlement after fees/taxes: ₹{expected}",
                    f"Actual settlement credited: ₹{actual}",
                    f"Net discrepancy: ₹{diff}"
                ],
                limitations=["Fee tier card category metadata was not specified in the payments file."]
            )

        # 4. Refund Mismatch
        elif exception_type == "REFUND_MISMATCH":
            ref_amt = details.get("total_refund_amount", diff)
            return AIInvestigationOutput(
                summary=f"Customer refund of ₹{ref_amt} was recorded for payment {pid}, but was not deducted from the settlement payout.",
                what_happened=f"A refund of ₹{ref_amt} was issued for payment {pid}. However, the settlement credited (₹{actual}) represents the full unrefunded gross amount rather than the refund-adjusted net payout (₹{expected}).",
                why_it_matters=f"The customer received ₹{ref_amt} refund while the merchant also received full gross settlement. The aggregator will subsequently deduct this amount in a future batch.",
                possible_causes=[
                    "Timing difference: Refund was initiated after settlement batch had already been finalized.",
                    "Gateway queued refund deduction for a future weekly/monthly invoice cycle.",
                    "Manual customer refund issued outside automated payment gateway workflow."
                ],
                recommended_actions=[
                    f"Check subsequent settlement batches to confirm if ₹{ref_amt} is deducted later.",
                    "Verify refund settlement ARN / RRN reference code in payment gateway dashboard.",
                    "Ensure accounting ledger tracks this liability against future payout cycles."
                ],
                confidence=0.97,
                evidence_points=[
                    f"Payment {pid} capture amount: ₹{amt}",
                    f"Customer refund amount: ₹{ref_amt}",
                    f"Expected refund-adjusted payout: ₹{expected}",
                    f"Actual unadjusted settlement credit: ₹{actual}"
                ],
                limitations=["Future settlement batches beyond current dataset window cannot be checked."]
            )

        # 5. Fee Anomaly
        elif exception_type in ["FEE_ANOMALY", "UNEXPECTED_FEE"]:
            act_fee = details.get("actual_fee", fees.get("fee_amount", "0"))
            exp_fee = details.get("expected_fee", "0")
            eff_rate = details.get("effective_fee_rate_percent", "0")
            return AIInvestigationOutput(
                summary=f"Processing fee of ₹{act_fee} ({eff_rate}%) on payment {pid} significantly exceeds standard contractual MDR fee (₹{exp_fee}).",
                what_happened=f"For payment {pid} of ₹{amt}, standard contractual MDR fee is ₹{exp_fee} (1.80%), but charged MDR fee was ₹{act_fee} (Effective rate: {eff_rate}%).",
                why_it_matters=f"Represents ₹{diff} in excess fee deductions, directly reducing merchant transaction margins.",
                possible_causes=[
                    "Payment made using commercial, corporate, or international card tier subject to higher interchange.",
                    "Gateway billing misclassification or expired promotional rate slab.",
                    "Additional gateway risk surcharge or cross-border markup applied."
                ],
                recommended_actions=[
                    f"Check card brand, card type (Credit/Debit/Corporate), and issuing bank for {pid}.",
                    "Review merchant service agreement (MSA) for non-standard payment instrument pricing.",
                    "Request fee reconciliation audit report from aggregator account representative."
                ],
                confidence=0.95,
                evidence_points=[
                    f"Payment {pid} amount: ₹{amt}",
                    f"Standard 1.8% MDR expectation: ₹{exp_fee}",
                    f"Actual fee billed: ₹{act_fee} ({eff_rate}%)",
                    f"Excess fee deduction: ₹{diff}"
                ],
                limitations=["Card BIN metadata is required to conclusively verify interchange category."]
            )

        # 6. Delayed Settlement
        elif exception_type == "DELAYED_SETTLEMENT":
            del_days = details.get("delay_days", 0)
            return AIInvestigationOutput(
                summary=f"Settlement for payment {pid} took {del_days} days to credit, breaching the standard T+2 SLA window.",
                what_happened=f"Payment {pid} was captured on {details.get('payment_created_at', pay.get('created_at'))} but settlement was only credited on {details.get('settlement_date')}, taking {del_days} days.",
                why_it_matters="While funds were eventually received, SLA violations disrupt merchant working capital planning and treasury operations.",
                possible_causes=[
                    "Bank holiday or weekend clearing blackout delaying RTGS/NEFT batch.",
                    "Risk engine temporary security verification hold prior to payout release.",
                    "Nodal account batch routing failure resolved after retry."
                ],
                recommended_actions=[
                    "Check calendar for bank holidays or non-business days during the delay period.",
                    "Review gateway communication logs for any risk review notices on this date.",
                    "Track gateway SLA compliance metrics for merchant service level review."
                ],
                confidence=0.93,
                evidence_points=[
                    f"Payment capture timestamp: {details.get('payment_created_at', pay.get('created_at'))}",
                    f"Settlement credit timestamp: {details.get('settlement_date')}",
                    f"Elapsed duration: {del_days} days (Contractual SLA: 3 days)",
                    f"Net funds credited: ₹{actual}"
                ],
                limitations=["Bank holiday calendar for regional acquiring banks is not embedded in dataset."]
            )

        # 7. Orphan Settlement
        elif exception_type == "ORPHAN_SETTLEMENT":
            sid = details.get("settlement_id", "UNKNOWN_SETTLEMENT")
            return AIInvestigationOutput(
                summary=f"Settlement record {sid} of ₹{amt} references unknown payment ID '{pid}' not found in the payments ledger.",
                what_happened=f"A bank settlement credit of ₹{amt} was recorded under settlement ID {sid}, but payment ID '{pid}' does not exist in the payments ledger.",
                why_it_matters=f"An unmapped payout of ₹{amt} cannot be reconciled against order management or customer fulfillment records.",
                possible_causes=[
                    "Payment was captured through an alternate merchant account or legacy MID.",
                    "Offline or manual payment adjustment credited directly through gateway backend.",
                    "Data ingestion gap: Payments CSV missing earlier capture batch."
                ],
                recommended_actions=[
                    f"Search order management system (OMS) for payment reference {pid}.",
                    "Verify whether multiple sub-merchant MIDs are active under the organization.",
                    "Re-export payments CSV to confirm all capture timeframes were included."
                ],
                confidence=0.97,
                evidence_points=[
                    f"Settlement ID: {sid}",
                    f"Referenced payment ID: {pid}",
                    f"Orphan payout amount: ₹{amt}",
                    "Corresponding payment capture record in database: NONE"
                ],
                limitations=["Cannot search external order systems not connected to LeakLens."]
            )

        # Generic Fallback
        return AIInvestigationOutput(
            summary=f"Identified {exception_type} on transaction {pid} with financial discrepancy of ₹{diff}.",
            what_happened=f"Reconciliation engine identified discrepancy between expected settlement (₹{expected}) and actual settlement (₹{actual}).",
            why_it_matters=f"Impacts financial auditability with potential discrepancy of ₹{diff}.",
            possible_causes=["Discrepancy between ledger record and payment aggregator report."],
            recommended_actions=[f"Inspect transaction {pid} on payment provider portal."],
            confidence=0.90,
            evidence_points=[f"Payment ID: {pid}", f"Expected: ₹{expected}", f"Actual: ₹{actual}", f"Difference: ₹{diff}"],
            limitations=[]
        )


class GroqAIService(BaseAIService):
    """
    Production Groq LLM provider utilizing high-throughput Llama 3 models with JSON mode.
    """
    provider_name: str = "groq"
    model_name: str = "llama-3.3-70b-versatile"

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or getattr(settings, "AI_API_KEY", "") or getattr(settings, "GROQ_API_KEY", "")
        if model:
            self.model_name = model

    async def investigate(
        self,
        evidence: Dict[str, Any],
        exception_type: str,
        severity: str
    ) -> AIInvestigationOutput:
        if not self.api_key:
            logger.warning("Groq API key not configured. Falling back to MockAIService.")
            return await MockAIService().investigate(evidence, exception_type, severity)

        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=self.api_key)
            
            prompt = build_investigation_prompt(evidence, exception_type, severity)
            
            response = await client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": INVESTIGATION_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=1024,
            )

            raw_json = response.choices[0].message.content
            parsed = json.loads(raw_json)
            return AIInvestigationOutput(**parsed)
        except Exception as e:
            logger.error(f"Groq AI investigation failed: {e}. Falling back to Mock provider.", exc_info=True)
            return await MockAIService().investigate(evidence, exception_type, severity)


def get_ai_service(provider: Optional[str] = None) -> BaseAIService:
    """Factory to retrieve the configured AI provider instance."""
    prov = (provider or getattr(settings, "AI_PROVIDER", "mock")).lower()
    
    if prov == "groq":
        return GroqAIService()
    elif prov == "mock":
        return MockAIService()
    else:
        # Default to Mock
        return MockAIService()
