# LeakLens — Screenshot & Walkthrough Guide

This checklist details the key visual surfaces of LeakLens for evaluator demonstration and submission artifacts.

---

### 1. Landing Page (`/`)
- **Purpose**: First impression, value proposition, and 1-click demo entrypoint.
- **Key Elements to Notice**:
  - Prominent **[Try LeakLens (1-Click Demo)]** button.
  - Live Discrepancy Snapshot showing ₹37,720.00 money leakage preview.
  - 7-step architecture flow cards and live backend operational status badge.

---

### 2. Merchant Overview Dashboard (`/dashboard`)
- **Purpose**: Executive settlement health, discrepancy KPI cards, and priority exceptions.
- **Key Elements to Notice**:
  - **Unexplained Money Leakage Banner**: Immediate ₹X impact visualization.
  - **Reconciliation Rate & Volume Cards**: Total Volume, Expected Settlement, Actual Settlement.
  - **Prioritized High-Value Exceptions Table**: Severity badges and direct 1-click drill-down.

---

### 3. Critical Exception Detail & AI Investigation (`/exceptions/[id]`)
- **Purpose**: Deep-dive audit into an individual financial anomaly.
- **Key Elements to Notice**:
  - **Deterministic Ledger Facts**: Payment Capture, Expected Payout, Actual Credit, Variance.
  - **AI Investigation Panel**: Executive summary, confirmed ledger events, plausible root causes, and safe recommended actions.
  - **Structured Evidence Badges**: Verified factual evidence tags.

---

### 4. Ask LeakLens Natural Language Controller (`/investigate`)
- **Purpose**: Multi-turn conversational interface for ad-hoc financial queries.
- **Key Elements to Notice**:
  - Sample prompt chips: *"Why is today's settlement lower?"*, *"Show me all critical exceptions"*.
  - Rich answer cards with clickable **Evidence Ledger Pills**.

---

### 5. Action Center Investigation Queue (`/action-center`)
- **Purpose**: Human-in-the-loop triage management and workflow lifecycle.
- **Key Elements to Notice**:
  - Status filters (`OPEN`, `INVESTIGATING`, `RESOLVED`, `IGNORED`).
  - Interactive state transition buttons (`Start Investigation`, `Resolve`, `Reopen`).
  - **Auditor Notes & Chronological Audit Timeline** with actor attribution.

---

### 6. Reports & PDF / CSV Export (`/reports`)
- **Purpose**: Formal financial audit statements and spreadsheet downloads.
- **Key Elements to Notice**:
  - Interactive Report Preview with discrepancy breakdown.
  - **[Download Official PDF]**: Two-pass ReportLab A4 formal document.
  - **[Export CSV]**: Formula-injection-safe financial tables.

---

### 7. Multi-File Data Ingestion Pipeline (`/upload`)
- **Purpose**: Production CSV upload for real merchant data.
- **Key Elements to Notice**:
  - 4-card drag-and-drop zone (Payments, Settlements, Refunds, Fees).
  - Schema auto-detection confidence scores and manual dropdown mapping overrides.
  - Row validation metrics and preview before import.

---

### 8. Benchmark Generator & Ground Truth Evaluator (`/generator`, `/evaluation`)
- **Purpose**: Mathematical validation against 10,000 ground-truth transactions.
- **Key Elements to Notice**:
  - Precision: **`100.0%`**, Recall: **`100.0%`**, F1 Score: **`1.0000`**.
  - Performance latency graph under 200 ms.
