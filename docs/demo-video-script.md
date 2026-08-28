# LeakLens — 3 to 5 Minute Demo Video Script

**Target Duration:** 3:30 – 4:30 Minutes  
**Audience:** Razorpay AI Buildathon Judges & Finance Controller Evaluators  
**Goal:** Clearly demonstrate problem, deterministic reconciliation, AI investigation, natural language querying, human action triage, and report generation.

---

### Segment 1: The Problem (0:00 – 0:25)
- **Visual:** Split screen of merchant payment dashboard vs bank statement vs spreadsheet filled with discrepancies.
- **Narrator Voiceover:**
  > *"Every day, online merchants process thousands of customer payments. But when payments, settlements, refunds, and gateway fees are compared across different records, they rarely match up cleanly. Missing settlements, duplicate payouts, and incorrect fee deductions leak thousands of rupees. Reconciling this manually in spreadsheets is slow, error-prone, and nearly impossible to scale."*

---

### Segment 2: Introduction to LeakLens & Landing Page (0:25 – 0:50)
- **Visual:** Browser showing `http://localhost:3000` (LeakLens Landing Page). Cursor hovering over the live discrepancy preview card.
- **Narrator Voiceover:**
  > *"This is LeakLens — an AI-assisted merchant settlement intelligence and reconciliation platform. LeakLens establishes deterministic financial truth first, identifies where money leaks, and uses evidence-grounded AI to help merchants investigate and fix anomalies."*

---

### Segment 3: 1-Click Demo & Deterministic Reconciliation (0:50 – 1:25)
- **Visual:** Click **[Try LeakLens (1-Click Demo)]**. The system instantly generates and reconciles a 500-transaction benchmark and lands smoothly on the **Dashboard** (`/dashboard`).
- **Narrator Voiceover:**
  > *"With one click, LeakLens ingests payment and settlement records and runs our deterministic reconciliation engine. In under 25 milliseconds, it calculates the exact expected settlement down to the exact paisa using Python Decimal math, eliminating floating-point errors."*

---

### Segment 4: Merchant Overview Dashboard (1:25 – 1:55)
- **Visual:** Dashboard page highlighting **₹37,720.00 Unexplained Money Leakage**, volume cards (Total Volume ₹10L, Expected vs. Actual Settlement), and the **Prioritized High-Value Exceptions** table.
- **Narrator Voiceover:**
  > *"On the dashboard, the merchant immediately sees the financial impact: ₹37,720 in unexplained discrepancies across processed transactions. LeakLens automatically categorizes issues across 7 exact deterministic exception classes, prioritizing the highest-value discrepancies at the top of the queue."*

---

### Segment 5: Critical Exception & Grounded AI Investigation (1:55 – 2:35)
- **Visual:** Click on the top Critical exception (`MISSING_SETTLEMENT`). Opens the Exception Detail page (`/exceptions/[id]`). Displays the deterministic ledger comparison table, followed by the **AI Investigation Card**.
- **Narrator Voiceover:**
  > *"Let's drill into this critical exception. Here, payment PAY_108 succeeded for ₹4,500, but no settlement credit was ever received from the acquiring bank. Rather than guessing, LeakLens feeds structured ledger facts into our Evidence-Grounded AI Investigator. The AI summarizes what happened, identifies plausible causes like an uncaptured bank settlement batch, and recommends non-destructive next steps."*

---

### Segment 6: Ask LeakLens Natural Language Controller (2:35 – 3:15)
- **Visual:** Navigate to **Ask LeakLens** (`/investigate`). Type or click prompt: *"Why is today's settlement lower than expected?"* and *"Show me all critical exceptions"*. Response appears with structured evidence pills.
- **Narrator Voiceover:**
  > *"Instead of writing complex SQL queries or filtering endless spreadsheets, the merchant can use Ask LeakLens. It translates natural language questions into deterministic aggregation plans, answering with verified ledger evidence pills without hallucinating non-existent records."*

---

### Segment 7: Action Center & Human-in-the-Loop Triage (3:15 – 3:50)
- **Visual:** Navigate to **Action Center** (`/action-center`). Filter by OPEN issues. Click **[Start Investigation]** (status moves to `INVESTIGATING`). Add an auditor note: *"Claim submitted to bank settlement team"*. Mark issue as **[RESOLVED]**.
- **Narrator Voiceover:**
  > *"LeakLens is an investigation assistant, not an autonomous agent that moves money. In the Action Center, human finance teams control the triage lifecycle. We can transition states from Open to Investigating, add internal auditor notes, and resolve issues, maintaining an immutable, chronological audit trail."*

---

### Segment 8: Reports, PDF & Safe CSV Export (3:50 – 4:20)
- **Visual:** Navigate to **Reports & Export** (`/reports`). Click **[Generate Audit Report]**, preview the interactive executive summary, and click **[Download Official PDF]** to show the crisp ReportLab A4 statement.
- **Narrator Voiceover:**
  > *"Finally, merchants can export publication-ready A4 PDF audit statements and formula-injection-safe CSV ledgers to share directly with banking partners, auditors, and management."*

---

### Segment 9: Closing & Value Proposition (4:20 – 4:40)
- **Visual:** Return to the Landing Page hero section.
- **Narrator Voiceover:**
  > *"LeakLens delivers the perfect balance of deterministic mathematical authority and AI-driven intelligence. It helps merchants stop revenue leaks and regain complete control over their settlements. Thank you!"*
