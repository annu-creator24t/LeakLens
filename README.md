# LeakLens
### Find Where Your Money Doesn't Reconcile.

> **"Reconcile payments, settlements, refunds and fees, detect financial discrepancies, and investigate them using evidence-grounded AI."**  
> *Built for:* **Razorpay AI Buildathon — Track 04: AI Finance Controller**

---

## 1. Problem Statement
Online merchants (D2C, marketplaces, SaaS, digital commerce) process thousands of transactions daily across multiple payment providers, banks, and settlement batches. These records frequently disagree due to:
- **Missing Settlements**: Customer payments successfully captured but never credited to the merchant account.
- **Duplicate Settlements**: Double entries or duplicate settlement batch credits.
- **Amount Mismatches**: Captured payment amounts differing from credited payout amounts.
- **Refund Inconsistencies**: Excessive refunds or refund deductions without a corresponding captured payment.
- **Fee & Tax Anomalies**: Merchant Discount Rate (MDR) or GST charged in excess of contractual pricing.
- **Delayed Settlements**: Funds held beyond agreed $T+2$ banking SLAs.
- **Orphan Records**: Settlement credits referencing untracked or non-existent payment IDs.

**Manual reconciliation in spreadsheets is slow, error-prone, unscalable, and difficult to audit.**

---

## 2. Solution
**LeakLens creates a deterministic financial truth layer first.**
1. **Normalizes Ingested CSVs**: Parses Payments, Settlements, Refunds, and Fees into strict Python `Decimal` schemas.
2. **Deterministic Mathematical Reconciliation**: Calculates exact Expected Settlement ($P_{paid} - R_{refund} - F_{fee} - T_{tax}$) and compares against Actual Settlement.
3. **Classifies 7 Exact Exception Types**: Detects anomalies with financial impact and structured ledger evidence packets.
4. **Evidence-Grounded AI Investigation**: Translates structured evidence into root-cause explanations and safe next steps without hallucinating monetary values.
5. **Action Center Triage**: Manages the full human-in-the-loop investigation lifecycle (`OPEN` $\rightarrow$ `INVESTIGATING` $\rightarrow$ `RESOLVED` / `IGNORED`) with immutable audit trails.
6. **Publication-Ready Reports**: Generates formal A4 PDF statements and formula-injection-safe CSV ledgers.

---

## 3. Why AI? (Core Principle)
> **The LLM is NEVER the source of financial truth.**

```text
Deterministic Engine
       ↓ (Establishes verifiable financial facts)
Exception Classifier
       ↓ (Identifies exact discrepancy type & ₹ impact)
Structured Evidence
       ↓ (Provides complete transaction ledger context)
AI Investigator
       ↓ (Explains the discrepancy & hypothesizes root-cause)
Human Decision Maker
       ↓ (Verifies and takes safe financial action)
```

- **Deterministic Logic** guarantees mathematical reproducibility, 100% precision, and zero floating-point drift.
- **AI Layer** reduces human cognitive load by summarizing complex multi-table relationship breakdowns into clear executive briefings.

---

## 4. Key Features & Technical Differentiators
1. **Exact Decimal Monetary Precision**: Zero IEEE-754 floating-point drift (`Decimal` with `ROUND_HALF_UP`).
2. **7 Deterministic Exception Classes**:
   - `MISSING_SETTLEMENT`
   - `DUPLICATE_SETTLEMENT`
   - `AMOUNT_MISMATCH`
   - `REFUND_MISMATCH`
   - `FEE_ANOMALY`
   - `DELAYED_SETTLEMENT`
   - `ORPHAN_SETTLEMENT`
3. **Evidence-Grounded AI**: SHA-256 evidence hashing prevents duplicate LLM token consumption on page refresh.
4. **Natural Language Financial Controller (Ask LeakLens)**: Multi-turn natural-language Q&A backed by real-time aggregation queries and prompt-injection defense.
5. **Human-in-the-Loop Action Center**: State machine with strict transition guards, auditor notes, and immutable audit logs.
6. **Production Upload Pipeline**: Multi-file drag-and-drop CSV ingestion with heuristic column matching, type coercion, and orphan relationship tolerance.
7. **Audit-Grade Reports**: Formal A4 PDF generation via ReportLab `NumberedCanvas` and CSV formula-injection defense.
8. **Multi-Tenant Dataset Isolation**: Enforced `dataset_id` partitioning across all database queries, preventing IDOR data leaks.

---

## 5. Complete System Architecture

```text
Merchant Financial Data (CSVs / Generator)
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Phase 2 & 11: Ingestion, Validation & Schema Mapping   │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Phase 4: Deterministic Reconciliation Engine           │
│ Expected = Paid - Refund - Fee - Tax                   │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Phase 5: 7-Rule Exception Detection Engine             │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Phase 6: Merchant Discrepancy Dashboard                │
└──────┬──────────────────────┬───────────────────┬──────┘
       │                      │                   │
       ▼                      ▼                   ▼
┌──────────────┐      ┌──────────────┐    ┌──────────────┐
│   Phase 7:   │      │   Phase 8:   │    │   Phase 9:   │
│ AI Root-Cause│      │ Ask LeakLens │    │Action Center │
│ Investigator │      │  (NL Query)  │    │Triage Queue  │
└──────┬───────┘      └──────┬───────┘    └──────┬───────┘
       │                      │                   │
       └──────────────────────┼───────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────┐
│ Phase 10: Reports & Safe CSV Export Engine             │
└────────────────────────────────────────────────────────┘
```

---

## 6. Official 10,000-Transaction Benchmark Results
Evaluated against ground-truth injected anomalies using standard reproducible parameters:
- **Transaction Count**: `10,000`
- **Seed**: `12345`
- **Anomaly Rate**: `5.0%` (500 injected anomalies)

| Metric | Measured Result |
| :--- | :--- |
| **True Positives (TP)** | **500** |
| **False Positives (FP)** | **0** |
| **False Negatives (FN)** | **0** |
| **Precision** | **100.0%** |
| **Recall** | **100.0%** |
| **F1 Score** | **1.0000** |
| **Reconciliation Latency** | **186 ms** (10k records) |

---

## 7. Automated Test Suite & QA
- **Backend Tests**: **106 passed** in **7.07s** (`pytest tests/ -v`).
- **Frontend Build**: **14 / 14 routes statically and dynamically compiled** with 0 TypeScript/lint errors (`npm run build`).
- **Security Audit**: Verified HTTP security headers (`nosniff`, `DENY`), zero tracked secrets, sanitized ASGI global exceptions, path traversal protection, and spreadsheet formula injection escaping.

---

## 8. Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript | Reactive fintech web user interface |
| **Styling & UI** | Vanilla CSS tokens, Tailwind CSS, Lucide React | Modern dark-mode fintech interface |
| **Backend API** | Python 3.10+, FastAPI, Uvicorn, Starlette | High-performance asynchronous REST API |
| **Financial Engine** | Python `Decimal` (`ROUND_HALF_UP`), NumPy, Pandas | Deterministic, precision-critical reconciliation |
| **Database** | MongoDB (Async Motor) with in-memory fallback | Persistent ledger storage and dataset isolation |
| **AI Layer** | Abstracted Provider (Gemini / OpenAI / Groq / Mock) | Structured evidence reasoning & NLP |
| **Reports** | ReportLab 3.x | Publication-ready two-pass A4 PDF statements |

---

## 9. Quick Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- (Optional) MongoDB 6.0+ (Backend runs with automated in-memory fallback if MongoDB is not present)

### 1. Start Backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Start Frontend
```powershell
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 10. Environment Variables (`.env.example`)

```env
# Application
ENVIRONMENT=development
LOG_LEVEL=info

# Server
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Database (Optional - in-memory fallback active if left empty)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=leaklens

# Security
JWT_SECRET=dev-secret-key-change-in-production-32bytesmin
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI Provider (mock, gemini, openai, groq)
AI_PROVIDER=mock
AI_API_KEY=
AI_MODEL_NAME=gemini-1.5-flash

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 11. Known Limitations
- **CSV-First Ingestion**: Currently ingests structured CSV files; direct payment gateway webhook streaming is slated for future phases.
- **Currency Standard**: Built primarily for INR (`₹`) reconciliation; multi-currency FX conversion matrices are not yet automated.
- **LLM Rate-Limits**: In cloud provider modes, investigations depend on provider quota thresholds; Mock mode provides zero-latency deterministic offline operation.

---

## 12. Future Roadmap
1. **Direct Gateway Connectors**: Automated sync adapters for payment gateways and core banking APIs.
2. **Multi-Currency Support**: Real-time FX rate settlement conversion matrices.
3. **Scheduled Automated Auditing**: Cron-driven nightly settlement reconciliation jobs.
4. **Role-Based Access Control (RBAC)**: Fine-grained permissions for Finance Leads, Auditors, and Operations.

---

## 13. License
Built with ❤️ for the **Razorpay AI Buildathon 2026**.
