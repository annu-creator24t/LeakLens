# LeakLens — Technical Q&A Guide

### Q1: Why not let the LLM reconcile transactions directly?
**Answer:**  
Financial reconciliation demands **deterministic, reproducible, and auditable arithmetic**. Large Language Models (LLMs) are probabilistic token predictors prone to hallucinations, non-determinism, and IEEE-754 precision drift. LeakLens uses deterministic Python `Decimal` algorithms to calculate mathematical truth and detect exceptions first. The LLM is strictly used as an analytical interpreter to explain pre-calculated structured evidence.

---

### Q2: How does LeakLens prevent monetary hallucinations?
**Answer:**  
1. **Grounded Prompts**: The LLM prompt context contains only pre-computed, deterministic facts (captured amount, expected settlement, actual settlement, timestamps).
2. **Authority Invariant**: All values rendered in UI cards, KPI metrics, and PDF statements originate directly from backend database records, never from unstructured LLM output strings.
3. **Negative Constraints**: System instructions explicitly forbid assuming refunds occurred or claiming settlements were credited unless ledger proof is present.

---

### Q3: What happens if the AI provider experiences an outage or rate-limit?
**Answer:**  
The entire reconciliation, exception classification, dashboard, action center triage, and PDF/CSV reporting engines operate **100% independently of the AI layer**. If an LLM provider fails (HTTP 500 or timeout), the system returns a safe degradation notice while preserving all financial calculations and exception details.

---

### Q4: How is financial precision guaranteed?
**Answer:**  
All financial amounts are represented and calculated using Python's `Decimal` type with `ROUND_HALF_UP` rounding to 2 decimal places. Floating-point numbers (`float` / JS `Number`) are prohibited from financial calculation paths, eliminating precision drift across 10,000+ row aggregations.

---

### Q5: How is multi-tenant dataset isolation enforced?
**Answer:**  
Every database collection query, cache lookup, report generator call, and natural-language query plan is strictly partitioned by `dataset_id`. Insecure Direct Object Reference (IDOR) attacks attempting to read or modify another dataset's exceptions return HTTP 404.

---

### Q6: How does LeakLens protect against spreadsheet formula injection?
**Answer:**  
When exporting CSV ledgers, all cell string values starting with formula execution operators (`=`, `@`, `+`, `-`) are passed through `sanitize_csv_value`, which prefixes them with a single quote (`'`), while leaving legitimate positive and negative financial figures intact.

---

### Q7: Can the AI autonomously resolve issues or move money?
**Answer:**  
**No.** LeakLens strictly enforces a **Human-in-the-Loop** model. The AI provides root-cause hypotheses and suggested actions, but status transitions (`OPEN` $\rightarrow$ `INVESTIGATING` $\rightarrow$ `RESOLVED` / `IGNORED`) require explicit authenticated user actions.

---

### Q8: What are the 7 deterministic exception classes?
**Answer:**  
1. `MISSING_SETTLEMENT` — Payment succeeded, but settlement credit is missing beyond SLA.
2. `DUPLICATE_SETTLEMENT` — Multiple settlement entries reference the same payment ID.
3. `AMOUNT_MISMATCH` — Actual settlement amount differs from expected payout calculation.
4. `REFUND_MISMATCH` — Refund deduction exceeds captured payment or references uncaptured transactions.
5. `FEE_ANOMALY` — MDR or GST deducted exceeds contracted pricing slabs.
6. `DELAYED_SETTLEMENT` — Settlement received after contractual $T+2$ banking window.
7. `ORPHAN_SETTLEMENT` — Settlement credit references an uncaptured / non-existent payment ID.

---

### Q9: How fast is the reconciliation engine?
**Answer:**  
- **1,000 transactions**: Parsing, reconciliation, and exception detection execute in **`22.7 ms`**.
- **10,000 transactions**: Complete reconciliation and classification execute in **`186.0 ms`**.
- **AI Investigation Cache**: SHA-256 evidence hashing retrieves cached investigations in **`< 1.0 ms`**.
