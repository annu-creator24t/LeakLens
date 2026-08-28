# LeakLens Security Architecture & Controls

## 1. Executive Security Summary
LeakLens is an audit-grade financial reconciliation and settlement intelligence platform. This document outlines the security controls, defense-in-depth layers, isolation boundaries, and safe AI execution guardrails implemented across the system.

---

## 2. Core Security Principles
1. **Deterministic Financial Authority**: The LLM is **NEVER** the source of financial truth. All monetary values, discrepancies, fees, taxes, and exception classifications originate strictly from deterministic backend calculations.
2. **Zero Autonomous Money Movement**: LeakLens strictly prohibits automated fund movements, refunds, payouts, or balance manipulations. Human decision-makers retain 100% control.
3. **Mandatory Dataset Isolation**: Every query, report, transaction, note, and AI investigation is strictly partitioned by `dataset_id`. Multi-tenant cross-dataset leakage is prevented at both the service and database layers.
4. **Zero Silent Data Loss**: All ingested rows, orphan settlements, and anomaly signals are preserved with audit logs rather than discarded.

---

## 3. Threat Model & Implemented Controls

| Threat / Vulnerability | Risk | Implemented Control & Mitigation | Status |
| :--- | :--- | :--- | :--- |
| **Path Traversal / Arbitrary File Writes** | High | User-supplied filenames are sanitized with `sanitize_filename` (stripping `../`, null bytes, illegal characters); files are stored outside publicly served directories with UUID keys. | **ENFORCED** |
| **Denial of Service (Oversized Uploads)** | High | Per-file size limits hard-capped at 25 MB; cumulative session limits capped at 100 MB. Rejects oversized payloads with HTTP 413. | **ENFORCED** |
| **CSV Formula Injection (CSV Injection)** | Medium | CSV export generator escapes leading formula operators (`=`, `@`, `+`, `-`) with a leading single quote `'` on text fields while preserving legitimate financial numbers. | **ENFORCED** |
| **Insecure Direct Object Reference (IDOR)** | High | Exception and transaction endpoints enforce strict scoping to the path-provided `dataset_id`. Requests attempting cross-dataset access return HTTP 404. | **ENFORCED** |
| **AI Prompt Injection & Exfiltration** | High | Aggregation-first architecture: The LLM receives pre-computed deterministic financial evidence rather than raw database access. Built-in regex and semantic guardrails reject system prompt/credential exfiltration. | **ENFORCED** |
| **AI Hallucination on Financial Data** | High | Grounded prompts require referencing structured evidence; prompts strictly forbid inventing transactions, fees, or claiming settlements occurred without ledger proof. | **ENFORCED** |
| **Secret & Key Leakage** | Critical | `.gitignore` excludes `.env`, `*.key`, `*.pem`, `scratch/`, and uploads; global exception handlers sanitize stack traces and internal paths from API responses. | **ENFORCED** |
| **Clickjacking & MIME Sniffing** | Medium | HTTP security headers middleware enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`. | **ENFORCED** |
| **Floating-Point Financial Drift** | High | All monetary arithmetic is executed in Python `Decimal` (`ROUND_HALF_UP`) to the exact cent/paise, eliminating JavaScript/IEEE-754 precision corruption. | **ENFORCED** |

---

## 4. Secret & Credential Handling
- Secrets (`JWT_SECRET`, `AI_API_KEY`, `MONGODB_URI`) are loaded strictly via environment variables (`pydantic-settings`).
- No production secrets or live database connection strings are tracked in the Git repository.
- Default fallback modes (Mock AI service and in-memory repository) allow fully functional local development and CI testing without requiring external credentials.

---

## 5. Security Limitations & Roadmap
1. **Multi-Tenant SSO**: Single-merchant session isolation is enforced via `dataset_id`; enterprise SAML/OAuth2 RBAC is planned for future phases.
2. **Automated Dynamic Rate Limiting**: In-memory safety thresholds protect expensive endpoints; production distributed rate limiting (Redis token bucket) is recommended for high-volume enterprise deployments.
