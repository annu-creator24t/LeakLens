"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Receipt,
  FileText,
  Clock,
  CheckCircle2,
  DollarSign,
  Info,
  RefreshCw,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Check,
  AlertCircle,
  Play,
  XCircle,
  RotateCcw,
  MessageSquare,
  Send,
  User
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
import { formatCurrency, formatDate } from "@/lib/formatters";

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-800/60" },
  HIGH: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-800/60" },
  MEDIUM: { bg: "bg-blue-950/60", text: "text-blue-400", border: "border-blue-800/60" },
  LOW: { bg: "bg-slate-800", text: "text-slate-400", border: "border-slate-700" },
};

export default function ExceptionDetailPage({ params }: { params: Promise<{ exception_id: string }> }) {
  const { exception_id } = use(params);
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id") || "";

  const [exception, setException] = useState<ExceptionItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

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
  const [modalNote, setModalNote] = useState<string>("");

  useEffect(() => {
    if (datasetId && exception_id) {
      loadDetail();
      checkStoredAI();
      loadHistory();
    }
  }, [datasetId, exception_id]);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExceptionDetail(datasetId, exception_id);
      setException(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exception details.");
    } finally {
      setLoading(false);
    }
  };

  const checkStoredAI = async () => {
    try {
      const stored = await fetchStoredAIInvestigation(datasetId, exception_id);
      if (stored) setAiData(stored);
    } catch {
      // Ignored
    }
  };

  const loadHistory = async () => {
    try {
      const hist = await fetchInvestigationHistory(datasetId, exception_id);
      setNotes(hist.notes);
      setAuditEvents(hist.audit_events);
      if (exception && hist.current_status) {
        setException({ ...exception, status: hist.current_status });
      }
    } catch {
      // Ignored
    }
  };

  const handleRunAIInvestigation = async (force: boolean = false) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await triggerAIInvestigation(datasetId, exception_id, force);
      setAiData(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI Investigation is temporarily unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleStartInvestigation = async () => {
    setActionLoading(true);
    try {
      await startInvestigation(datasetId, exception_id);
      if (exception) setException({ ...exception, status: "INVESTIGATING" });
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
      await addInvestigationNote(datasetId, exception_id, noteInput.trim());
      setNoteInput("");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  };

  const handleConfirmModalAction = async () => {
    if (!modalType || !modalNote.trim()) return;
    setActionLoading(true);
    try {
      if (modalType === "RESOLVE") {
        await resolveException(datasetId, exception_id, modalNote.trim());
        if (exception) setException({ ...exception, status: "RESOLVED" });
      } else if (modalType === "IGNORE") {
        await ignoreException(datasetId, exception_id, modalNote.trim());
        if (exception) setException({ ...exception, status: "IGNORED" });
      }
      setModalType(null);
      setModalNote("");
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
      await reopenException(datasetId, exception_id);
      if (exception) setException({ ...exception, status: "OPEN" });
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen exception.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!datasetId) {
    return (
      <AppShell>
        <div className="p-12 text-center text-slate-500 font-mono">
          No dataset session provided in query params.
        </div>
      </AppShell>
    );
  }

  const currentStatus = exception?.status || "OPEN";

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        
        {/* Back Link & Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={`/action-center?dataset_id=${datasetId}`}
            className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Action Center</span>
          </Link>

          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
            Session: {datasetId}
          </span>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-16 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm font-semibold text-white">Loading Exception Audit Breakdown...</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Content Body */}
        {!loading && exception && (
          <div className="space-y-6">
            
            {/* Hero Summary & Status Controls Header */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-5">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-11 h-11 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg font-bold text-white tracking-tight">
                        {exception.exception_type}
                      </h1>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                          currentStatus === "RESOLVED"
                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                            : currentStatus === "INVESTIGATING"
                            ? "bg-amber-950/60 text-amber-400 border-amber-800"
                            : currentStatus === "IGNORED"
                            ? "bg-slate-900 text-slate-400 border-slate-700"
                            : "bg-rose-950/60 text-rose-400 border-rose-800"
                        }`}
                      >
                        {currentStatus}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 mt-1">
                      <span>ID: {exception.exception_id}</span>
                      <span>•</span>
                      <span>Detected: {formatDate(exception.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Action Buttons Bar */}
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {currentStatus === "OPEN" && (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleStartInvestigation}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-md"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Investigation</span>
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setModalType("IGNORE")}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700 cursor-pointer"
                      >
                        <span>Ignore</span>
                      </button>
                    </>
                  )}

                  {currentStatus === "INVESTIGATING" && (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setModalType("RESOLVE")}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-md"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Resolved</span>
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setModalType("IGNORE")}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700 cursor-pointer"
                      >
                        <span>Ignore</span>
                      </button>
                    </>
                  )}

                  {(currentStatus === "RESOLVED" || currentStatus === "IGNORED") && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleReopen}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reopen Exception</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                {exception.description}
              </div>
            </div>

            {/* AI INVESTIGATION SECTION */}
            <div className="rounded-xl border border-blue-900/50 bg-gradient-to-b from-blue-950/20 via-[#0c121e] to-[#0c121e] p-6 space-y-5 shadow-xl relative overflow-hidden">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2">
                      <span>AI Financial Investigation</span>
                      {aiData && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300">
                          {Math.round(aiData.investigation.confidence * 100)}% AI Confidence
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Evidence-grounded diagnostic analysis derived exclusively from deterministic records.
                    </p>
                  </div>
                </div>

                {aiData ? (
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleRunAIInvestigation(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer self-start"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin text-blue-400" : ""}`} />
                    <span>Re-analyze</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleRunAIInvestigation(false)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] cursor-pointer self-start"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
                    <span>{aiLoading ? "Analyzing Evidence..." : "Investigate with AI"}</span>
                  </button>
                )}
              </div>

              {aiLoading && (
                <div className="p-8 text-center space-y-3">
                  <div className="flex items-center justify-center space-x-2 text-blue-400">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-mono font-medium">Cross-referencing payment records, fee slabs, and SLA windows...</span>
                  </div>
                </div>
              )}

              {aiError && (
                <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300 flex items-center justify-between">
                  <span>{aiError}</span>
                  <button
                    type="button"
                    onClick={() => handleRunAIInvestigation(true)}
                    className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-white text-[11px]"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!aiData && !aiLoading && !aiError && (
                <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-slate-200">No investigation report generated for this exception yet.</p>
                    <p className="text-slate-400">Click below to generate a root-cause diagnostic explaining what happened.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRunAIInvestigation(false)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run AI Investigation</span>
                  </button>
                </div>
              )}

              {!aiLoading && aiData && (
                <div className="space-y-5 text-xs">
                  <div className="p-4 rounded-lg bg-blue-950/30 border border-blue-800/40 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-semibold">
                      Diagnostic Executive Summary
                    </span>
                    <p className="text-slate-200 text-xs leading-relaxed font-medium">
                      {aiData.investigation.summary}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                        What Happened? (Confirmed Facts)
                      </span>
                      <p className="text-slate-300 leading-relaxed">
                        {aiData.investigation.what_happened}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                        Why It Matters? (Financial Impact)
                      </span>
                      <p className="text-slate-300 leading-relaxed">
                        {aiData.investigation.why_it_matters}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                      Plausible Explanations (Hypotheses)
                    </span>
                    <ul className="space-y-1.5 pl-1">
                      {aiData.investigation.possible_causes.map((cause, idx) => (
                        <li key={idx} className="flex items-start space-x-2 text-slate-300">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{cause}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block">
                      Recommended Safe Next Steps
                    </span>
                    <ul className="space-y-1.5 pl-1">
                      {aiData.investigation.recommended_actions.map((act, idx) => (
                        <li key={idx} className="flex items-start space-x-2 text-slate-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                      Evidence Grounding Points
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {aiData.investigation.evidence_points.map((pt, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center space-x-1.5"
                        >
                          <CheckCircle2 className="w-3 h-3 text-blue-400" />
                          <span>{pt}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Financial Calculation & Transaction References */}
            <div className="grid md:grid-cols-2 gap-6">
              
              <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
                <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <span>Deterministic Calculation Breakdown</span>
                </h2>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">Calculated Expected Net</span>
                    <span className="font-bold text-blue-400">{formatCurrency(exception.expected_settlement)}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">Actual Bank Credit</span>
                    <span className="font-bold text-slate-200">{formatCurrency(exception.actual_settlement)}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/40 flex items-center justify-between">
                    <span className="text-rose-400">Discrepancy</span>
                    <span className="font-bold text-rose-300">{formatCurrency(exception.amount_discrepancy)}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
                <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>Transaction References</span>
                </h2>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">Payment ID</span>
                    {exception.payment_id ? (
                      <Link
                        href={`/transactions/${exception.payment_id}?dataset_id=${datasetId}`}
                        className="text-blue-400 hover:underline flex items-center space-x-1"
                      >
                        <span>{exception.payment_id}</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span className="text-slate-500">N/A</span>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">Severity</span>
                    <span className="text-amber-300 font-bold">{exception.severity}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">Investigation Status</span>
                    <span className="text-slate-200 font-bold">{currentStatus}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* INVESTIGATION NOTES COMPOSER & HISTORY */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>Merchant Investigation Notes</span>
              </h2>

              {/* Note Input */}
              <div className="space-y-2">
                <textarea
                  rows={3}
                  placeholder="Add notes about provider verification, tickets raised, or settlement checks..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={savingNote || !noteInput.trim()}
                    onClick={handleSaveNote}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>{savingNote ? "Saving..." : "Save Note"}</span>
                  </button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                {notes.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono text-center py-3">
                    No investigation notes added yet.
                  </p>
                ) : (
                  notes.map((n) => (
                    <div key={n.note_id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span className="font-semibold text-slate-300 flex items-center space-x-1">
                          <User className="w-3 h-3 text-blue-400" />
                          <span>{n.actor}</span>
                        </span>
                        <span>{formatDate(n.created_at)}</span>
                      </div>
                      <p className="text-slate-200 font-mono">{n.note}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* UNIFIED AUDIT TIMELINE */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Unified Audit Timeline</span>
              </h2>

              <div className="space-y-4 relative pl-5 border-l-2 border-slate-800 ml-2">
                {/* Transaction detection events */}
                {exception.timeline?.map((step, idx) => (
                  <div key={idx} className="relative space-y-0.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -left-[27px] top-1 border-2 border-[#0c121e]" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{step.event}</span>
                      <span className="text-[10px] font-mono text-slate-500">{formatDate(step.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">{step.details}</p>
                  </div>
                ))}

                {/* Audit state transitions & notes */}
                {auditEvents.map((aud) => (
                  <div key={aud.audit_id} className="relative space-y-0.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -left-[27px] top-1 border-2 border-[#0c121e]" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-400 font-mono">{aud.action}</span>
                      <span className="text-[10px] font-mono text-slate-500">{formatDate(aud.created_at)}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono">
                      {aud.previous_status} → {aud.new_status} (by {aud.actor})
                      {aud.note ? ` • "${aud.note}"` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Resolve / Ignore Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c121e] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white tracking-tight">
              {modalType === "RESOLVE" ? "Resolve Exception" : "Ignore Exception"}
            </h3>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              {modalType === "RESOLVE"
                ? "Please document how this settlement discrepancy was investigated and verified:"
                : "Please document the justification for ignoring this exception:"}
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400">
                {modalType === "RESOLVE" ? "Resolution Summary Note (Required):" : "Reason Note (Required):"}
              </label>
              <textarea
                rows={3}
                placeholder={modalType === "RESOLVE" ? "e.g. Settlement credit confirmed in gateway report." : "e.g. Below operational dispute threshold."}
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !modalNote.trim()}
                onClick={handleConfirmModalAction}
                className={`px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center space-x-1.5 ${
                  modalType === "RESOLVE" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm {modalType === "RESOLVE" ? "Resolution" : "Ignore"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
