# LEAKLENS
> **"See where your money leaks."**  
> *AI-Powered Merchant Settlement Intelligence & Deterministic Reconciliation Platform*  
> **Built for:** Razorpay AI Buildathon — Track 04: AI Finance Controller

---

## 1. What LeakLens Is
**LeakLens** is an AI-powered financial intelligence platform designed for online merchants (D2C, Shopify, SaaS, marketplaces) to automatically reconcile transactions, detect settlement discrepancies, and pinpoint where money leaks between payment capture and bank settlement.

### Core Product Principle
> **Financial truth comes from deterministic logic. AI is used for investigation, explanation, prioritization, and natural-language analysis.**  
> The LLM must NEVER calculate financial truth or invent transaction facts. Calculations are auditable, reproducible, and deterministic; AI translates structured evidence into actionable root-cause insights.

---

## 2. Core Problem
When an online merchant processes ₹10,00,000 in customer payments:
- **Expected Settlement:** ₹9,72,000 (after accounting for refunds, gateway fee slabs, and GST).
- **Actual Settlement Received:** ₹9,41,500.
- **Unexplained Discrepancy:** **₹30,500**.

Investigating this manually across thousands of CSV rows in spreadsheets requires cross-referencing payment IDs, order IDs, settlement batch IDs, refund timestamps, and fee structures. LeakLens automates this end-to-end.

---

## 3. Product Architecture

```
                                  +---------------------------------------+
                                  | Merchant CSVs                         |
                                  | (Payments, Settlements, Refunds, Fees)|
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  | Parser & Normalizer Service           |
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  | Deterministic Reconciliation Engine   |
                                  | Expected = Paid - Refund - Fee - Tax  |
                                  +-------------------+-------------------+
                                                      |
                         +----------------------------+----------------------------+
                         |                                                         |
                         v                                                         v
          +------------------------------+                          +------------------------------+
          | 7 Exception Classifiers      |                          | Reconciled Matched Records   |
          | - Missing Settlement         |                          +------------------------------+
          | - Amount Mismatch            |
          | - Duplicate Settlement       |
          | - Refund Mismatch            |
          | - Unexpected Fee             |
          | - Delayed Settlement         |
          | - Orphan Settlement          |
          +--------------+---------------+
                         |
                         v
          +------------------------------+
          | Structured Evidence Packets  |
          +--------------+---------------+
                         |
                         v
          +------------------------------+
          | Abstracted AI Investigator   |
          | (Root Cause + Action Items)  |
          +--------------+---------------+
                         |
                         v
+-----------------------------------------------------------------------------------+
| Modern Fintech Web Dashboard & Audit-Ready PDF Reports                            |
| - Discrepancy KPI Cards | Priority Triage Queue | Ask LeakLens | Ground Truth Benchmark |
+-----------------------------------------------------------------------------------+
```

---

## 4. Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript | High-performance interactive UI |
| **Styling & Icons** | Tailwind CSS, Lucide React | Modern, clean fintech SaaS design system |
| **Charts** | Recharts | Financial discrepancy and volume visualization |
| **Backend** | Python 3.10+, FastAPI, Uvicorn | Async REST API and deterministic math engine |
| **Data Processing**| Pandas, NumPy, Pydantic v2 | High-throughput record normalization and validation |
| **Database** | MongoDB (via Motor async client) | Persistent record store with graceful dev fallback |
| **Authentication** | JWT (JSON Web Tokens), Passlib | Secure merchant session management |
| **AI Layer** | Abstracted Base Provider (Gemini / OpenAI / Groq / Mock) | Evidence-grounded reasoning & natural language queries |
| **Reports** | ReportLab | Exportable PDF financial audit statements |

---

## 5. Repository Structure

```
LeakLens/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point & lifespan
│   │   ├── config/
│   │   │   ├── __init__.py
│   │   │   └── settings.py          # Pydantic BaseSettings & env loader
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   └── session.py           # Async MongoDB connection manager
│   │   ├── routes/
│   │   │   ├── __init__.py          # API router aggregator
│   │   │   └── health.py            # /api/health endpoint
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── financial.py         # Pydantic schemas (Payment, Settlement, etc.)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── ai_base.py           # Abstracted AI Provider Interface
│   │   ├── models/                  # Database entity models
│   │   └── utils/                   # Shared helper utilities
│   ├── requirements.txt             # Backend dependencies
│   └── .venv/                       # Python virtual environment
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # Dark fintech SaaS layout
│   │   │   ├── page.tsx             # Professional landing page
│   │   │   └── globals.css          # Theme tokens and grid styles
│   │   ├── lib/
│   │   │   └── api.ts               # Backend API client
│   │   └── types/
│   │       └── index.ts             # TypeScript definitions
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.ts
│
├── data/
│   ├── sample/                      # Sample merchant CSV files
│   └── generated/                   # Synthetic benchmark datasets
│
├── docs/
│   └── architecture.md              # Detailed design documentation
│
├── .gitignore
├── .env.example
└── README.md
```

---

## 6. Frontend Setup

### Prerequisites
- Node.js 20+ or 22+
- npm 10+

### Steps
```bash
cd frontend
npm install
npm run dev
```
The frontend starts on `http://localhost:3000`.

---

## 7. Backend Setup

### Prerequisites
- Python 3.10+

### Steps
```bash
# From repository root
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend starts on `http://localhost:8000`. Interactive OpenAPI documentation is accessible at `http://localhost:8000/docs`.

---

## 8. Environment Variables

Copy the template file to configure your local setup:
```bash
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | Runtime mode (`development`, `production`) |
| `BACKEND_HOST` | `127.0.0.1` | Host address for FastAPI backend |
| `BACKEND_PORT` | `8000` | Port for FastAPI backend |
| `ALLOWED_ORIGINS`| `http://localhost:3000` | CORS allowed origins |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string (graceful fallback if unset) |
| `MONGODB_DB_NAME`| `leaklens` | MongoDB database name |
| `JWT_SECRET` | `dev-secret...` | Secret key for signing JWT tokens |
| `AI_PROVIDER` | `mock` | Active provider: `mock`, `gemini`, `openai`, `groq` |
| `AI_API_KEY` | `""` | API key for selected LLM provider |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base API URL for Next.js frontend |

---

## 9. 🤖 Phase 7: Evidence-Grounded AI Investigator
LeakLens introduces an auditable, evidence-grounded AI investigator designed specifically to explain financial reconciliation exceptions:
1. **Core Principle**: The LLM is **NEVER** the source of financial truth. All numbers come strictly from the deterministic reconciliation engine.
2. **Provider Abstraction**: Pluggable provider architecture (`MockAIService`, `GroqAIService`, `GeminiAIService`) configured via `AI_PROVIDER`.
3. **Structured Pydantic Output**: Generates validated schemas containing `summary`, `what_happened`, `why_it_matters`, `possible_causes`, `recommended_actions`, `confidence`, and `evidence_points`.
4. **Deterministic Evidence Hashing**: Every investigation hashes the canonicalized JSON evidence (`SHA-256`) to guarantee deterministic cache reuse and avoid redundant LLM invocations.
5. **Anti-Hallucination Guardrails**: Prompts and validation strictly forbid inventing transactions, fees, refunds, or claiming automated financial actions were taken.

---

## 10. 💬 Phase 8: Ask LeakLens Natural Language Investigation
Ask LeakLens provides a plain-language financial investigation assistant on `/investigate`:
1. **Architecture**: `User Question` $\rightarrow$ `QueryPlanner` $\rightarrow$ `Safe Backend QueryExecutor (Aggregation-First)` $\rightarrow$ `Structured Financial Evidence` $\rightarrow$ `Grounded AI Reasoning` $\rightarrow$ `Clickable Evidence & Links`.
2. **Security & Guardrails**:
   - Zero direct database access for the LLM (no raw MongoDB operators or arbitrary queries).
   - Built-in regex and semantic defense against prompt injections, credential harvesting, and system prompt exfiltration.
   - Strictly scoped to active `dataset_id` (mandatory dataset isolation).
3. **10 Supported Financial Intents**: `DATASET_SUMMARY`, `FINANCIAL_DISCREPANCY`, `EXCEPTION_BREAKDOWN`, `TOP_EXCEPTIONS`, `MISSING_SETTLEMENTS`, `DUPLICATE_SETTLEMENTS`, `REFUND_ISSUES`, `FEE_ISSUES`, `DELAYED_SETTLEMENTS`, and `TRANSACTION_LOOKUP`.
4. **Interactive Evidence Chips**: Directly links answers to `/transactions/{payment_id}` and `/exceptions/{exception_id}`.

---

## 11. How to Run Locally

### Option A: Run Backend & Frontend in Two Terminals

**Terminal 1 (Backend):**
```bash
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 12. 🧪 Verification & Testing
Run the complete backend test suite:
```powershell
cd backend
.venv\Scripts\pytest tests/ -v
```

Build the frontend production bundle:
```powershell
cd frontend
npm run build
```

---

## 10. Current Development Phase

> **Phase 1: Project Foundation (COMPLETED)**  
> - Clean monorepo structure with decoupled frontend and backend.
> - FastAPI backend operational with `/api/health` and lifespan DB handling.
> - Next.js 15 TypeScript frontend with dark fintech SaaS design system.
> - Shared conceptual schemas for financial entities (Payment, Settlement, Refund, Fee, Exception).
> - Abstracted AI Provider Interface with mock fallback.
> - Environment configuration and Git safety guardrails.

---

## 11. Planned Phases

- **Phase 2: Ingestion & Deterministic Reconciliation Engine**
  - High-performance CSV parser and schema normalizer for the 4 core datasets.
  - Mathematical reconciliation engine implementing the 7 exception classifiers.
  - Severity scoring and priority queue generator.
- **Phase 3: Synthetic Data Generator & Ground Truth Benchmarking**
  - Generator capable of producing 100 to 10,000+ realistic transaction rows with injected anomalies.
  - Ground-truth evaluation engine measuring Precision, Recall, and Processing Latency.
- **Phase 4: Grounded AI Investigator & "Ask LeakLens"**
  - Integration of Gemini / Groq / OpenAI with JSON schema enforcement.
  - Evidence-backed root-cause analysis and natural language query assistant.
- **Phase 5: Full SaaS Dashboard & Audit Reports**
  - Discrepancy KPI overview, interactive exception triage, timeline breakdown.
  - Audit-ready PDF report generation.
