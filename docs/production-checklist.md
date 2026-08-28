# LeakLens Production Deployment Checklist

| Category | Checklist Item | Status | Verification Detail |
| :--- | :--- | :--- | :--- |
| **Environment** | `.env.example` complete with all configuration options | **PASS** | Documented in root `.env.example` with safe development defaults |
| **Environment** | Zero tracked secrets, keys, or credentials in Git | **PASS** | Repository-wide secret scan verified clean |
| **Security** | HTTP Security Headers enabled (`nosniff`, `DENY`, `Referrer-Policy`) | **PASS** | Middleware enforced in `backend/app/main.py` |
| **Security** | Sanitized Global Exception Handler (No stack traces / paths leaked) | **PASS** | `global_exception_handler` intercepts all 500s |
| **Security** | Insecure Direct Object Reference (IDOR) protection | **PASS** | Endpoints strictly validate and filter by `dataset_id` |
| **Security** | Path Traversal & Filename Sanitization | **PASS** | `sanitize_filename` enforces safe alphanumeric basenames |
| **Security** | CSV Formula Injection Protection | **PASS** | `sanitize_csv_value` escapes leading `=`, `@`, `+`, `-` characters |
| **Security** | AI Prompt Injection & System Prompt Guardrails | **PASS** | Query planner regex & semantic refusal barriers |
| **Financial Engine** | Deterministic Reconciliation Engine with Decimal precision | **PASS** | Exact Decimal rounding (`ROUND_HALF_UP`) with 0 float drift |
| **Financial Engine** | 7 Structured Exception Detection Rules | **PASS** | Verified against ground truth on 10,000 transaction benchmark |
| **Data Ingestion** | Multi-File CSV Upload (Payments, Settlements, Refunds, Fees) | **PASS** | Streaming CSV parser with schema auto-detection & override |
| **Data Ingestion** | 25 MB per-file / 100 MB combined upload limits | **PASS** | Verified with boundary size enforcement |
| **AI Investigator** | Evidence-Grounded AI with SHA-256 caching | **PASS** | Caches deterministic JSON evidence hash to prevent duplicate LLM calls |
| **Ask LeakLens** | Natural Language Aggregation-First Querying | **PASS** | Safe query execution without direct LLM database writes |
| **Action Center** | Investigation Lifecycle State Machine (`OPEN` $\rightarrow$ `RESOLVED`) | **PASS** | Verified status transitions, notes, and chronological audit trail |
| **Reports & Export** | A4 Publication-Ready PDF & UTF-8 CSV Ledger Exports | **PASS** | ReportLab two-pass NumberedCanvas with matching metrics |
| **Frontend** | Responsive Next.js UI with zero hydration errors | **PASS** | Clean production build across all 14 application routes |
| **Backend Testing** | Automated Pytest Test Suite | **PASS** | 106/106 passing tests across all components |
| **Git Governance** | Clean working tree synchronized on `origin/main` | **PASS** | Verified with `git status` |
