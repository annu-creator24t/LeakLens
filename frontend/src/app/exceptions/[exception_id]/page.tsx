"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Receipt,
  Layers,
  FileText,
  Clock,
  CheckCircle2,
  DollarSign,
  Info,
  RefreshCw,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Check,
  AlertCircle,
  Cpu
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchExceptionDetail,
  updateExceptionStatus,
  triggerAIInvestigation,
  fetchStoredAIInvestigation,
  ExceptionItem,
  InvestigationResponse
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
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // AI Investigation State
  const [aiData, setAiData] = useState<InvestigationResponse | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (datasetId && exception_id) {
      loadDetail();
      checkStoredAI();
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
      if (stored) {
        setAiData(stored);
      }
    } catch {
      // Ignored if no previous investigation exists
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

  const handleStatusChange = async (newStatus: string) => {
    if (!exception) return;
    setUpdatingStatus(true);
    try {
      await updateExceptionStatus(datasetId, exception.exception_id, newStatus);
      setException({ ...exception, status: newStatus });
    } catch (err) {
      console.error("Failed to update status", err);
    } finally {
      setUpdatingStatus(false);
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

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        
        {/* Back Link & Quick Controls */}
        <div className="flex items-center justify-between">
          <Link
            href={`/exceptions?dataset_id=${datasetId}`}
            className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Exceptions Queue</span>
          </Link>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Status:</span>
            <select
              disabled={updatingStatus || !exception}
              value={exception?.status || "OPEN"}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1 font-mono focus:outline-none focus:border-blue-500"
            >
              <option value="OPEN">OPEN</option>
              <option value="INVESTIGATING">INVESTIGATING</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="IGNORED">IGNORED</option>
            </select>
          </div>
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
            
            {/* Hero Summary Card */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white tracking-tight">
                      {exception.exception_type}
                    </h1>
                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 mt-0.5">
                      <span>ID: {exception.exception_id}</span>
                      <span>•</span>
                      <span>Logged: {formatDate(exception.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Potential Financial Impact</span>
                  <span className="text-2xl font-bold font-mono text-rose-400">
                    {formatCurrency(exception.amount_discrepancy)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                {exception.description}
              </div>
            </div>

            {/* ======================================================== */}
            {/* AI INVESTIGATION SECTION (PHASE 7 WOW COMPONENT)        */}
            {/* ======================================================== */}
            <div className="rounded-xl border border-blue-900/50 bg-gradient-to-b from-blue-950/20 via-[#0c121e] to-[#0c121e] p-6 space-y-5 shadow-xl relative overflow-hidden">
              
              {/* Header */}
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

                {/* Top Action Button */}
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

              {/* AI Loading State */}
              {aiLoading && (
                <div className="p-8 text-center space-y-3">
                  <div className="flex items-center justify-center space-x-2 text-blue-400">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-mono font-medium">Cross-referencing payment records, fee slabs, and SLA windows...</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">Grounding hypotheses against authoritative financial calculations</p>
                </div>
              )}

              {/* AI Error State */}
              {aiError && (
                <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{aiError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRunAIInvestigation(true)}
                    className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-white text-[11px]"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* IDLE State CTA */}
              {!aiData && !aiLoading && !aiError && (
                <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-200">No investigation report generated for this exception yet.</p>
                    <p className="text-slate-400">
                      Click below to generate a structured root-cause diagnostic explaining what happened, why it matters, and safe merchant next steps.
                    </p>
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

              {/* SUCCESS / CACHED Result Body */}
              {!aiLoading && aiData && (
                <div className="space-y-5 text-xs">
                  
                  {/* Summary Callout */}
                  <div className="p-4 rounded-lg bg-blue-950/30 border border-blue-800/40 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-semibold">
                      Diagnostic Executive Summary
                    </span>
                    <p className="text-slate-200 text-xs leading-relaxed font-medium">
                      {aiData.investigation.summary}
                    </p>
                  </div>

                  {/* Two Column Grid: What Happened & Why it Matters */}
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

                  {/* Possible Causes & Hypotheses */}
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

                  {/* Recommended Next Steps */}
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

                  {/* Evidence Points Verified Chips */}
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

                  {/* Limitations and Disclaimers */}
                  {aiData.investigation.limitations?.length > 0 && (
                    <div className="text-[11px] text-slate-500 font-mono pt-1">
                      <span className="text-slate-400 font-semibold">Observations: </span>
                      {aiData.investigation.limitations.join(" • ")}
                    </div>
                  )}

                  {/* Footer Metadata */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-500 gap-2">
                    <div className="flex items-center space-x-3">
                      <span>Provider: <strong className="text-slate-400">{aiData.metadata.provider}</strong></span>
                      <span>Model: <strong className="text-slate-400">{aiData.metadata.model}</strong></span>
                      <span>Prompt: <strong className="text-slate-400">{aiData.metadata.prompt_version}</strong></span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span>Latency: {aiData.metadata.generation_time_ms} ms</span>
                      {aiData.cached && <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">Cached</span>}
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Two Column Grid: Financial Calculation & Transaction Info */}
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Financial Calculation Breakdown */}
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

                <div className="text-[11px] text-slate-500 font-mono">
                  Formula: Expected = Payment - Refunds - MDR Fee - GST Tax
                </div>
              </div>

              {/* Transaction Context */}
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
                    <span className="text-slate-400">Audit Status</span>
                    <span className="text-slate-200">{exception.status}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Lifecycle Timeline */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Transaction Lifecycle Timeline</span>
              </h2>

              <div className="space-y-4 relative pl-5 border-l-2 border-slate-800 ml-2">
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
              </div>
            </div>

            {/* Machine-Readable Evidence Payload */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Auditable Evidence Packet</span>
              </h2>
              <pre className="p-4 rounded-lg bg-slate-950 text-slate-300 text-[11px] font-mono overflow-x-auto border border-slate-800">
                {JSON.stringify(exception.evidence, null, 2)}
              </pre>
            </div>

          </div>
        )}

      </div>
    </AppShell>
  );
}
