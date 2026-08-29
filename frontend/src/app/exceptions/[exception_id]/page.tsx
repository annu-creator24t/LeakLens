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
  Database
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
      setSuccessBanner("Note saved.");
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
        setSuccessBanner("Investigation resolved.");
      } else if (modalType === "IGNORE") {
        await ignoreException(datasetId, exceptionId, note);
        setException((prev) => (prev ? { ...prev, status: "IGNORED" } : null));
        setSuccessBanner("Exception marked as ignored.");
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
      <LoadingState
        message="Loading exception details..."
        subMessage="Extracting structured evidence ledger"
        size="lg"
      />
    );
  }

  if (!exception) {
    return (
      <ErrorState
        message={error || "Exception record not found."}
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
      label: `Payment gross amount: ₹${Number(evidenceObj.payment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      verified: true,
    });
  }

  if (exception.expected_settlement !== undefined) {
    evidenceFactList.push({
      label: `Calculated expected settlement: ₹${Number(exception.expected_settlement).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
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
        "Settlement batch may not yet have been processed by the acquiring bank.",
        "Gateway deduction rules or tax reconciliation may differ from contract.",
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
      subtitle: evidenceObj.settlement_found === false ? "Settlement Search" : "Settlement Processing",
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
    { label: "Overview", href: `/dashboard?dataset_id=${datasetId}` },
    { label: "Exceptions", href: `/exceptions?dataset_id=${datasetId}` },
    { label: exception.payment_id || exception.exception_id, isCurrent: true },
  ];

  return (
    <div className="space-y-8">
      
      {/* Breadcrumbs & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
        <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-slate-400 hover:text-white text-xs font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. INVESTIGATION BRIEF: Reusable Component in the First Viewport */}
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

      {/* 2. CAUSAL EVIDENCE LEDGER */}
      <div className="rounded-xl border border-slate-800 bg-[#0c121e] p-6 space-y-4">
        <EvidenceLedger steps={causalSteps} />
      </div>

      {/* 3. AI INVESTIGATION: Evidence-Grounded Analysis */}
      <div className="rounded-xl border border-blue-900/40 bg-[#0c1424] p-6 space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-900/40">
          <div>
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                AI INVESTIGATION
              </h3>
            </div>
            <p className="text-xs text-blue-300/80 mt-0.5">
              Evidence-grounded analysis synthesized strictly from verified ledger facts.
            </p>
          </div>

          {/* AI Trust Indicator */}
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono px-3 py-1 rounded-md bg-blue-950/80 border border-blue-800/60 text-blue-300 font-semibold flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Based on {evidenceFactList.length} verified ledger facts</span>
            </span>

            <button
              type="button"
              disabled={aiLoading}
              onClick={() => handleRunAIInvestigation(true)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3 h-3 ${aiLoading ? "animate-spin" : ""}`} />
              <span>{aiLoading ? "Investigating..." : aiData ? "Re-analyze Evidence" : "Run AI Investigation"}</span>
            </button>
          </div>
        </div>

        {aiError && (
          <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-900/50 text-xs text-rose-300">
            {aiError}
          </div>
        )}

        {/* Distinguish CONFIRMED facts from POSSIBLE CAUSES */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* CONFIRMED Facts */}
          <div className="space-y-3 p-4 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CONFIRMED FACTS</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">Deterministic Truth</span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              {evidenceFactList.map((fact, fIdx) => (
                <div key={fIdx} className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{fact.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* POSSIBLE CAUSES (Hypotheses) */}
          <div className="space-y-3 p-4 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>POSSIBLE CAUSES</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">AI Hypothesis</span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              {possibleCausesList.map((cause, cIdx) => (
                <div key={cIdx} className="flex items-start space-x-2">
                  <span className="text-amber-400 font-bold">•</span>
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
        <div className="lg:col-span-6 p-6 rounded-xl border border-slate-800 bg-[#0c121e] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span>Investigation Notes</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">{notes.length} Recorded</span>
          </div>

          {/* Notes list */}
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {notes.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono p-4 text-center rounded bg-slate-950/40">
                No investigation notes added yet.
              </p>
            ) : (
              notes.map((n) => (
                <div key={n.note_id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 space-y-1 text-xs">
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
              placeholder="Add an investigation note..."
              className="flex-1 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="button"
              disabled={savingNote || !noteInput.trim()}
              onClick={handleSaveNote}
              className="p-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Audit Timeline */}
        <div className="lg:col-span-6 p-6 rounded-xl border border-slate-800 bg-[#0c121e] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Immutable Audit Timeline</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">{auditEvents.length} Events</span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {auditEvents.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono p-4 text-center rounded bg-slate-950/40">
                No audit events recorded.
              </p>
            ) : (
              auditEvents.map((evt) => (
                <div key={evt.audit_id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-blue-400">
                      {evt.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatDate(evt.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                    <span>{evt.previous_status}</span>
                    <span>→</span>
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

      {/* Confirmation Dialog for Resolution / Ignore */}
      <ConfirmDialog
        isOpen={modalType !== null}
        title={modalType === "RESOLVE" ? "Mark this issue as resolved?" : "Ignore this exception?"}
        description={
          modalType === "RESOLVE"
            ? "Record a mandatory audit note explaining how this discrepancy was cleared or settled."
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
