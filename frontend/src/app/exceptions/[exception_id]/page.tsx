"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Receipt,
  FileText,
  Clock,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  MessageSquare,
  Send,
  User,
  Activity,
  ArrowRight,
  Database,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchExceptionDetail,
  triggerAIInvestigation,
  fetchStoredAIInvestigation,
  startInvestigation,
  addInvestigationNote,
  resolveException,
  ignoreException,
  reopenException,
  fetchInvestigationHistory,
  ExceptionItem,
  InvestigationResponse,
  InvestigationNote,
  InvestigationAuditEvent
} from "@/lib/api";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { SeverityBadge, StatusBadge } from "@/components/ui/Badges";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, ErrorState } from "@/components/ui/FeedbackStates";
import { InvestigationBrief } from "@/components/investigation/InvestigationBrief";
import { EvidenceLedger, EvidenceStep } from "@/components/investigation/EvidenceLedger";
import { DeterministicExplanation } from "@/components/investigation/DeterministicExplanation";
import { NextStepGuidance } from "@/components/ui/NextStepGuidance";
import { formatDate } from "@/lib/formatters";

const EXCEPTION_TITLES: Record<string, string> = {
  MISSING_SETTLEMENT: "Missing Settlement",
  DUPLICATE_SETTLEMENT: "Duplicate Settlement",
  AMOUNT_MISMATCH: "Amount Mismatch",
  REFUND_MISMATCH: "Refund Mismatch",
  FEE_ANOMALY: "Fee Anomaly (Excess MDR)",
  DELAYED_SETTLEMENT: "Delayed Settlement (SLA Breach)",
  ORPHAN_SETTLEMENT: "Orphan Settlement",
};

function ExceptionDetailContent({ exceptionId }: { exceptionId: string }) {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id") || "";

  const [exception, setException] = useState<ExceptionItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // AI Investigation State
  const [aiData, setAiData] = useState<InvestigationResponse | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // History & Notes State
  const [notes, setNotes] = useState<InvestigationNote[]>([]);
  const [auditEvents, setAuditEvents] = useState<InvestigationAuditEvent[]>([]);
  const [noteInput, setNoteInput] = useState<string>("");
  const [savingNote, setSavingNote] = useState<boolean>(false);

  // Modal State
  const [modalType, setModalType] = useState<"RESOLVE" | "IGNORE" | null>(null);

  useEffect(() => {
    if (datasetId && exceptionId) {
      loadDetail();
      checkStoredAI();
      loadHistory();
    }
  }, [datasetId, exceptionId]);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExceptionDetail(datasetId, exceptionId);
      setException(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while loading this exception.");
    } finally {
      setLoading(false);
    }
  };

  const checkStoredAI = async () => {
    try {
      const stored = await fetchStoredAIInvestigation(datasetId, exceptionId);
      if (stored) setAiData(stored);
    } catch {
      // Ignored
    }
  };

  const loadHistory = async () => {
    try {
      const hist = await fetchInvestigationHistory(datasetId, exceptionId);
      setNotes(hist.notes || []);
      setAuditEvents(hist.audit_events || []);
      if (exception && hist.current_status) {
        setException((prev) => (prev ? { ...prev, status: hist.current_status } : null));
      }
    } catch {
      // Ignored
    }
  };

  const handleRunAIInvestigation = async (force: boolean = false) => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await triggerAIInvestigation(datasetId, exceptionId, force);
      setAiData(res);
      setSuccessBanner("AI Investigation generated successfully.");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI Investigation is temporarily unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleStartInvestigation = async () => {
    setActionLoading(true);
    try {
      await startInvestigation(datasetId, exceptionId);
      setException((prev) => (prev ? { ...prev, status: "INVESTIGATING" } : null));
      setSuccessBanner("Investigation started.");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start investigation.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteInput.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await addInvestigationNote(datasetId, exceptionId, noteInput.trim());
      setNoteInput("");
      setSuccessBanner("Investigation note recorded.");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  };

  const handleConfirmModalAction = async (note: string) => {
    if (!modalType || !note.trim()) return;
    setActionLoading(true);
    try {
      if (modalType === "RESOLVE") {
        await resolveException(datasetId, exceptionId, note);
        setException((prev) => (prev ? { ...prev, status: "RESOLVED" } : null));
        setSuccessBanner("Investigation resolved successfully.");
      } else if (modalType === "IGNORE") {
        await ignoreException(datasetId, exceptionId, note);
        setException((prev) => (prev ? { ...prev, status: "IGNORED" } : null));
        setSuccessBanner("Exception marked as bypassed/ignored.");
      }
      setModalType(null);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    setActionLoading(true);
    try {
      await reopenException(datasetId, exceptionId);
      setException((prev) => (prev ? { ...prev, status: "OPEN" } : null));
      setSuccessBanner("Exception reopened for investigation.");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen exception.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!datasetId) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono text-xs">
        No dataset session provided in query params.
      </div>
    );
  }

  if (loading && !exception) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading exception details">
        {/* Breadcrumb Skeleton */}
        <div className="h-4 w-48 rounded bg-slate-800/60" />

        {/* Top Brief Skeleton */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-4">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-6 w-64 rounded bg-slate-800/80" />
              <div className="h-4 w-32 rounded bg-slate-800/40" />
            </div>
            <div className="h-8 w-24 rounded bg-slate-800/60" />
          </div>
          <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/60">
            <div className="h-16 rounded-xl bg-slate-900/60" />
            <div className="h-16 rounded-xl bg-slate-900/60" />
            <div className="h-16 rounded-xl bg-slate-900/60" />
          </div>
        </div>

        {/* Evidence Ledger Skeleton */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-4">
          <div className="h-5 w-48 rounded bg-slate-800/70" />
          <div className="space-y-3 pt-2">
            <div className="h-12 rounded-xl bg-slate-900/60" />
            <div className="h-12 rounded-xl bg-slate-900/60" />
            <div className="h-12 rounded-xl bg-slate-900/60" />
          </div>
        </div>

        {/* AI Investigation Skeleton */}
        <div className="p-6 rounded-2xl border border-blue-900/40 bg-[#0c1424] space-y-4">
          <div className="h-6 w-52 rounded bg-blue-800/40" />
          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <div className="h-32 rounded-xl bg-slate-900/60" />
            <div className="h-32 rounded-xl bg-slate-900/60" />
          </div>
        </div>
      </div>
    );
  }

  if (!exception) {
    return (
      <ErrorState
        message={error || "Exception record not found in this dataset session."}
        onRetry={loadDetail}
      />
    );
  }

  // Construct structured evidence checklist facts from evidence object
  const evidenceObj = exception.evidence || {};
  const evidenceFactList: Array<{ label: string; verified: boolean; detail?: string }> = [];

  if (exception.payment_id) {
    evidenceFactList.push({
      label: "Payment captured successfully",
      verified: true,
      detail: `Payment ID: ${exception.payment_id}`,
    });
  }

  if (evidenceObj.payment_amount !== undefined) {
    evidenceFactList.push({
      label: `Payment gross captured: ₹${Number(evidenceObj.payment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      verified: true,
    });
  }

  if (exception.expected_settlement !== undefined) {
    evidenceFactList.push({
      label: `Expected net payout: ₹${Number(exception.expected_settlement).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      verified: true,
      detail: "Gross minus contracted fee & refund deductions",
    });
  }

  if (evidenceObj.settlement_found === false || exception.exception_type === "MISSING_SETTLEMENT") {
    evidenceFactList.push({
      label: "No settlement record found in bank payout batch",
      verified: true,
      detail: "Settlement ID missing from gateway file",
    });
  } else if (evidenceObj.settlement_amount !== undefined) {
    evidenceFactList.push({
      label: `Settlement amount recorded: ₹${Number(evidenceObj.settlement_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      verified: true,
      detail: `Difference: ₹${Number(exception.amount_discrepancy).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    });
  }

  if (evidenceObj.refund_amount !== undefined && Number(evidenceObj.refund_amount) > 0) {
    evidenceFactList.push({
      label: `Refund recorded on ledger: ₹${Number(evidenceObj.refund_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      verified: true,
    });
  }

  // AI-generated or fallback explanations
  const aiOutput = aiData?.investigation;
  const possibleCausesList = aiOutput?.possible_causes?.length
    ? aiOutput.possible_causes
    : [
        "Settlement batch may not yet have been credited by the acquiring gateway.",
        "Gateway deduction rules or tax withholding may differ from contracted MDR.",
        "Payout window may have breached standard T+2 settlement SLA.",
      ];

  const recommendedActionText = aiOutput?.recommended_actions?.[0] ||
    "Verify settlement batch status with the acquiring bank and check for pending payout holds.";

  const whatHappenedText = aiOutput?.what_happened || exception.description ||
    `Reconciliation engine identified an unresolved discrepancy of ₹${exception.amount_discrepancy.toLocaleString("en-IN", { minimumFractionDigits: 2 })} on payment ${exception.payment_id || exception.exception_id}.`;

  // Build causal ledger steps for visual causal chain
  const causalSteps: EvidenceStep[] = [
    {
      title: "01. PAYMENT CAPTURE",
      subtitle: exception.payment_id ? `Order / Payment: ${exception.payment_id}` : "Transaction Ingestion",
      amount: Number(evidenceObj.payment_amount || exception.expected_settlement),
      status: "SUCCESS",
      statusType: "success",
      details: [
        { label: "Payment ID", value: exception.payment_id || "N/A" },
        { label: "Captured Gross", value: `₹${Number(evidenceObj.payment_amount || exception.expected_settlement).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
      ],
    },
    {
      title: "02. GATEWAY SETTLEMENT",
      subtitle: evidenceObj.settlement_found === false ? "Settlement Batch Search" : "Settlement Processing",
      amount: Number(evidenceObj.settlement_amount || 0),
      status: evidenceObj.settlement_found === false ? "NOT FOUND" : `ACTUAL ₹${Number(evidenceObj.settlement_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      statusType: evidenceObj.settlement_found === false ? "danger" : "warning",
      details: [
        { label: "Expected Payout", value: `₹${Number(exception.expected_settlement).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
        { label: "Actual Received", value: `₹${Number(evidenceObj.settlement_amount || exception.actual_settlement || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
      ],
    },
    {
      title: "03. RECONCILIATION RESULT",
      subtitle: EXCEPTION_TITLES[exception.exception_type] || exception.exception_type,
      amount: exception.amount_discrepancy,
      status: "DISCREPANCY DETECTED",
      statusType: "danger",
      details: [
        { label: "Discrepancy", value: `₹${exception.amount_discrepancy.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
        { label: "Severity", value: exception.severity },
      ],
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: `/dashboard?dataset_id=${datasetId}` },
    { label: "Exceptions Queue", href: `/exceptions?dataset_id=${datasetId}` },
    { label: exception.payment_id || exception.exception_id, isCurrent: true },
  ];

  const isResolved = exception.status === "RESOLVED";
  const isIgnored = exception.status === "IGNORED";
  const isInvestigating = exception.status === "INVESTIGATING" || exception.status === "UNDER_REVIEW";

  return (
    <div className="space-y-8">
      
      {/* Breadcrumbs & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <Breadcrumbs items={breadcrumbItems} />

        <Link
          href={`/exceptions?dataset_id=${datasetId}`}
          className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Discrepancy Queue</span>
        </Link>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Contextual Next Step Guidance */}
      <NextStepGuidance
        storageKey="exception_detail_guidance"
        title="Investigation Guidance"
        guidance="Review the confirmed ledger facts and deterministic rules below first. AI-generated root causes are evidence-grounded hypotheses requiring human investigation."
      />

      {/* 1. INVESTIGATION BRIEF: Top Hero Section */}
      <InvestigationBrief
        exceptionType={exception.exception_type}
        exceptionTitle={EXCEPTION_TITLES[exception.exception_type] || exception.exception_type}
        severity={exception.severity}
        status={exception.status}
        amountDiscrepancy={exception.amount_discrepancy}
        paymentId={exception.payment_id}
        whatHappened={whatHappenedText}
        evidencePoints={evidenceFactList}
        possibleCauses={possibleCausesList}
        recommendedNextStep={recommendedActionText}
        onStartInvestigation={handleStartInvestigation}
        onResolve={() => setModalType("RESOLVE")}
        actionLoading={actionLoading}
      />

      {/* 2. DETERMINISTIC FINANCIAL COMPARISON & CAUSAL EVIDENCE LEDGER */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c121e] p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-blue-400" />
              <span>Deterministic Reconciliation Chain</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Step-by-step mathematical comparison from payment capture through gateway settlement.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
            Verified Ledger Truth
          </span>
        </div>

        <EvidenceLedger steps={causalSteps} />
      </div>

      {/* 3. DETERMINISTIC EXCEPTION EXPLAINABILITY: WHY THIS WAS FLAGGED */}
      <DeterministicExplanation exception={exception} />

      {/* 4. AI INVESTIGATION: Evidence-Grounded Root Cause */}
      <div className="rounded-2xl border border-blue-900/40 bg-[#0c1424] p-6 space-y-6 shadow-xl">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-900/40">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                AI ROOT-CAUSE INVESTIGATOR
              </h3>
            </div>
            <p className="text-xs text-blue-300/80 mt-0.5">
              Evidence-grounded causal synthesis strictly reasoned over confirmed ledger facts (zero math in prompts).
            </p>
          </div>

          {/* AI Trust & Trigger Button */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-blue-950/80 border border-blue-800/60 text-blue-300 font-semibold flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{evidenceFactList.length} Verified Ledger Facts</span>
            </span>

            <button
              type="button"
              disabled={aiLoading}
              onClick={() => handleRunAIInvestigation(true)}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-md"
            >
              <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
              <span>{aiLoading ? "Investigating..." : aiData ? "Re-analyze Evidence" : "Run AI Investigation"}</span>
            </button>
          </div>
        </div>

        {aiError && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/50 text-xs text-rose-300">
            {aiError}
          </div>
        )}

        {/* Distinct CONFIRMED Facts vs POSSIBLE CAUSES */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* CONFIRMED Facts */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-850">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CONFIRMED LEDGER FACTS</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-500/80 px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-900/40">
                100% Deterministic
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              {evidenceFactList.map((fact, fIdx) => (
                <div key={fIdx} className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span>{fact.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* POSSIBLE CAUSES (Hypotheses) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-850">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>POSSIBLE ROOT CAUSES</span>
              </span>
              <span className="text-[10px] font-mono text-amber-500/80 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-900/40">
                AI Hypotheses
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              {possibleCausesList.map((cause, cIdx) => (
                <div key={cIdx} className="flex items-start space-x-2">
                  <span className="text-amber-400 font-bold shrink-0">•</span>
                  <span>{cause}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* 4. AUDIT TRAIL & INVESTIGATION NOTES */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Investigation Notes */}
        <div className="lg:col-span-6 p-6 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span>Investigation Notes</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{notes.length} Recorded</span>
          </div>

          {/* Notes list */}
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {notes.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono p-4 text-center rounded-xl bg-slate-950/40">
                No investigation notes added yet. Record auditor notes below.
              </p>
            ) : (
              notes.map((n) => (
                <div key={n.note_id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-850 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">{n.actor}</span>
                    <span className="font-mono">{formatDate(n.created_at)}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{n.note}</p>
                </div>
              ))
            )}
          </div>

          {/* Add note input */}
          <div className="pt-2 flex items-center space-x-2">
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveNote()}
              placeholder="Record auditor note..."
              className="flex-1 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors font-mono"
            />
            <button
              type="button"
              disabled={savingNote || !noteInput.trim()}
              onClick={handleSaveNote}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
              aria-label="Submit investigation note"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Immutable Audit Timeline */}
        <div className="lg:col-span-6 p-6 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Immutable Audit Timeline</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{auditEvents.length} Events</span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {auditEvents.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono p-4 text-center rounded-xl bg-slate-950/40">
                No audit events recorded yet.
              </p>
            ) : (
              auditEvents.map((evt) => (
                <div key={evt.audit_id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-850 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-blue-400">
                      {evt.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatDate(evt.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
                    <span>{evt.previous_status}</span>
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span className="text-emerald-400 font-semibold">{evt.new_status}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">{evt.actor}</span>
                  </div>
                  {evt.note && <p className="text-slate-300 text-xs pt-1 italic">&ldquo;{evt.note}&rdquo;</p>}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Lifecycle Actions Bar at the bottom */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-[#0c121e] flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center space-x-3 text-xs">
          <span className="text-slate-400 font-mono">Current Status:</span>
          <StatusBadge status={exception.status} size="md" />
        </div>

        <div className="flex items-center space-x-3">
          {(isResolved || isIgnored) && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleReopen}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reopen Discrepancy</span>
            </button>
          )}

          {!isResolved && !isIgnored && !isInvestigating && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleStartInvestigation}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Start Investigation</span>
            </button>
          )}

          {!isResolved && !isIgnored && (
            <>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setModalType("RESOLVE")}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Resolve Discrepancy</span>
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setModalType("IGNORE")}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-medium transition-colors cursor-pointer"
              >
                <span>Bypass</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Resolution / Ignore */}
      <ConfirmDialog
        isOpen={modalType !== null}
        title={modalType === "RESOLVE" ? "Mark this issue as resolved?" : "Ignore this exception?"}
        description={
          modalType === "RESOLVE"
            ? "Record a mandatory audit note explaining how this discrepancy was cleared or settled with the bank/gateway."
            : "Record an audit note explaining why this exception is bypassed."
        }
        confirmLabel={modalType === "RESOLVE" ? "Resolve Issue" : "Ignore Exception"}
        variant={modalType === "RESOLVE" ? "success" : "danger"}
        loading={actionLoading}
        onConfirm={handleConfirmModalAction}
        onCancel={() => setModalType(null)}
      />

    </div>
  );
}

export default function ExceptionDetailPage({ params }: { params: Promise<{ exception_id: string }> }) {
  const { exception_id } = use(params);

  return (
    <AppShell>
      <Suspense fallback={<LoadingState message="Loading exception brief..." />}>
        <ExceptionDetailContent exceptionId={exception_id} />
      </Suspense>
    </AppShell>
  );
}
