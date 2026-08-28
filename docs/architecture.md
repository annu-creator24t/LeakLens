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
   - Duplicate Settlement
   - Amount Mismatch
   - Refund Mismatch
   - Unexpected Fee (Fee Anomaly)
   - Delayed Settlement
   - Orphan Settlement
4. **Structured Evidence Generation**: Assemble auditable financial proofs for each exception.
5. **AI Investigator (Phase 7)**:
   - Pass structured evidence into provider abstraction (`BaseAIService`).
   - Validate outputs with Pydantic (`AIInvestigationOutput`).
   - Enforce deterministic evidence hashing (`SHA-256`) to guarantee cache validity and avoid redundant API costs.
   - Distinguish confirmed factual evidence from plausible operational hypotheses.
   - Prescribe safe, reversible next actions for merchant finance controllers.
6. **Executive Dashboard & Reporting (Phase 6 & 7)**:
   - Discrepancy KPI hero card, settlement truth cards, and prioritized attention queue.
   - Detailed exception triage and integrated AI Financial Investigation audit drawer.

## AI Provider Abstraction
```
                  ┌──────────────────────┐
                  │ AIInvestigatorService│
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │  MockAIService  │               │  GroqAIService  │
   │(Zero-API-Key CI)│               │(Llama 3.3 70B)  │
   └─────────────────┘               └─────────────────┘
```
