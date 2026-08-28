# LeakLens Architecture & Specifications

## Core Product Principle
**Financial calculations are deterministic; AI is used for investigation, explanation, prioritization, and natural-language analysis.**
The LLM must never invent financial facts or calculate monetary ground truth.

## Pipeline Architecture
1. **Ingestion & Validation**: Parse raw merchant files (`payments.csv`, `settlements.csv`, `refunds.csv`, `fees.csv`).
2. **Deterministic Reconciliation Engine**: Match records by ID and verify against:
   $$\text{Expected Settlement} = \text{Payment Amount} - \text{Refund Amount} - \text{Fee} - \text{Tax}$$
3. **Exception Classification**: Identify 7 deterministic exception classes:
   - Missing Settlement
   - Amount Mismatch
   - Duplicate Settlement
   - Refund Mismatch
   - Unexpected Fee
   - Delayed Settlement
   - Orphan Settlement
4. **Structured Evidence Generation**: Assemble auditable financial proofs for each exception.
5. **AI Investigator**: Pass structured evidence to an abstracted LLM service to generate root cause, risk analysis, and merchant action items.
6. **Executive Dashboard & Reporting**: Financial triage queue, discrepancy metrics, and exportable audit reports.
