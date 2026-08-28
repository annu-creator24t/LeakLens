"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Filter,
  DollarSign,
  ArrowRight,
  Database,
  ExternalLink,
  History,
  FileCheck
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchReportPreview,
  generateReportPdf,
  fetchReportHistory,
  getReportDownloadUrl,
  getCsvExportUrl,
  ReportPreviewResponse,
  ReportMetadata
} from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";

const EXCEPTION_TITLES: Record<string, string> = {
  MISSING_SETTLEMENT: "Missing Settlement",
  DUPLICATE_SETTLEMENT: "Duplicate Settlement",
  AMOUNT_MISMATCH: "Amount Mismatch",
  REFUND_MISMATCH: "Refund Mismatch",
  FEE_ANOMALY: "Fee Anomaly (Excess MDR)",
  DELAYED_SETTLEMENT: "Delayed Settlement (SLA Breach)",
  ORPHAN_SETTLEMENT: "Orphan Settlement",
};

function ReportsContent() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id") || "";

  const [preview, setPreview] = useState<ReportPreviewResponse | null>(null);
  const [history, setHistory] = useState<ReportMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<string>("ALL");

  useEffect(() => {
    if (datasetId) {
      loadReportData();
      loadHistory();
    }
  }, [datasetId, severityFilter, typeFilter, statusFilter, datePreset]);

  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReportPreview(datasetId, {
        severity: severityFilter,
        exception_type: typeFilter,
        status: statusFilter,
        date_preset: datePreset,
      });
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compile report preview.");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetchReportHistory(datasetId);
      setHistory(res.reports || []);
    } catch {
      // Ignored
    }
  };

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await generateReportPdf(datasetId, {
        severity: severityFilter,
        exception_type: typeFilter,
        status: statusFilter,
        date_preset: datePreset,
      });
      setSuccessMessage(`Report ${res.report_id} compiled successfully in ${res.generation_time_ms} ms.`);
      await loadHistory();
      // Trigger instant download
      window.open(getReportDownloadUrl(datasetId, res.report_id), "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate PDF.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (!datasetId) {
    return (
      <div className="p-12 rounded-xl border border-dashed border-slate-800 bg-[#0c121e]/40 flex flex-col items-center justify-center text-center space-y-4">
        <Database className="w-12 h-12 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-200">No Financial Session Selected</h2>
        <p className="text-xs text-slate-400">Select a financial dataset session to generate reports.</p>
        <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <span>Financial Reports & Export Center</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Generate audit-ready reconciliation PDF reports and export sanitized ledger records.
          </p>
        </div>

        {/* Quick Action Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={generatingPdf}
            onClick={handleGeneratePdf}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] cursor-pointer"
          >
            {generatingPdf ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Printer className="w-3.5 h-3.5" />
            )}
            <span>{generatingPdf ? "Compiling PDF..." : "Generate Audit PDF"}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Filter & Export Controls Panel */}
      <div className="p-4 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span>Report Configuration & Filters</span>
          </span>

          <span className="text-[11px] font-mono text-slate-500">
            Session: {datasetId}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-slate-400">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-slate-400">Exception Category</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Categories</option>
              <option value="MISSING_SETTLEMENT">Missing Settlement</option>
              <option value="DUPLICATE_SETTLEMENT">Duplicate Settlement</option>
              <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
              <option value="REFUND_MISMATCH">Refund Mismatch</option>
              <option value="FEE_ANOMALY">Fee Anomaly</option>
              <option value="DELAYED_SETTLEMENT">Delayed Settlement</option>
              <option value="ORPHAN_SETTLEMENT">Orphan Settlement</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-slate-400">Investigation Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="IGNORED">Ignored</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-slate-400">Date Range</label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Recorded Dates</option>
              <option value="TODAY">Today</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>
          </div>

        </div>

        {/* CSV Export Bar */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Raw CSV Ledger Exports:</span>
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={getCsvExportUrl(datasetId, "payments")}
              download
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white flex items-center space-x-1"
            >
              <Download className="w-3 h-3" />
              <span>Payments</span>
            </a>
            <a
              href={getCsvExportUrl(datasetId, "settlements")}
              download
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white flex items-center space-x-1"
            >
              <Download className="w-3 h-3" />
              <span>Settlements</span>
            </a>
            <a
              href={getCsvExportUrl(datasetId, "reconciliation")}
              download
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white flex items-center space-x-1"
            >
              <Download className="w-3 h-3" />
              <span>Reconciliation</span>
            </a>
            <a
              href={getCsvExportUrl(datasetId, "exceptions")}
              download
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white flex items-center space-x-1"
            >
              <Download className="w-3 h-3" />
              <span>Exceptions</span>
            </a>
            <a
              href={getCsvExportUrl(datasetId, "notes")}
              download
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white flex items-center space-x-1"
            >
              <Download className="w-3 h-3" />
              <span>Notes</span>
            </a>
            <a
              href={getCsvExportUrl(datasetId, "audit")}
              download
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white flex items-center space-x-1"
            >
              <Download className="w-3 h-3" />
              <span>Audit</span>
            </a>
          </div>
        </div>

      </div>

      {/* LIVE AUDIT REPORT PREVIEW */}
      {loading ? (
        <div className="p-16 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col items-center justify-center text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
          <p className="text-xs font-mono text-slate-400">Compiling financial report preview...</p>
        </div>
      ) : preview ? (
        <div className="space-y-6">
          
          {/* Printable Report Canvas Document */}
          <div className="p-8 rounded-2xl bg-[#0c121e] border border-slate-800 shadow-2xl space-y-6">
            
            {/* Header / Document Metadata */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-blue-400 font-bold block">
                  LEAKLENS FINANCIAL RECONCILIATION REPORT
                </span>
                <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
                  Reconciliation & Investigation Audit Summary
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Session ID: <span className="font-mono text-slate-200">{preview.dataset_id}</span>
                </p>
              </div>

              <div className="text-left sm:text-right space-y-0.5 text-xs font-mono text-slate-400">
                <div>Generated: <span className="text-slate-200">{preview.generated_at}</span></div>
                <div>Version: <span className="text-slate-200">{preview.report_version}</span></div>
              </div>
            </div>

            {/* Section 1: Financial Overview */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300">
                1. Executive Financial Overview
              </h3>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Payment Volume</span>
                  <span className="text-base font-bold text-white mt-0.5 block">
                    {formatCurrency(preview.financial_overview.total_volume)}
                  </span>
                  <span className="text-[10px] text-slate-500">{formatNumber(preview.financial_overview.total_transactions)} Transactions</span>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Expected Net</span>
                  <span className="text-base font-bold text-blue-400 mt-0.5 block">
                    {formatCurrency(preview.financial_overview.expected_settlement)}
                  </span>
                  <span className="text-[10px] text-slate-500">Post deductions</span>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Actual Bank Payout</span>
                  <span className="text-base font-bold text-slate-200 mt-0.5 block">
                    {formatCurrency(preview.financial_overview.actual_settlement)}
                  </span>
                  <span className="text-[10px] text-slate-500">Credited payouts</span>
                </div>

                <div className="p-3.5 rounded-lg bg-rose-950/30 border border-rose-900/40">
                  <span className="text-[10px] text-rose-400 uppercase block">Net Discrepancy</span>
                  <span className="text-base font-bold text-rose-300 mt-0.5 block">
                    {formatCurrency(preview.financial_overview.unexplained_difference)}
                  </span>
                  <span className="text-[10px] text-rose-400/80">{preview.financial_overview.reconciliation_rate.toFixed(1)}% Matched</span>
                </div>
              </div>
            </div>

            {/* Section 2: Exception Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300">
                2. Exception Breakdown Across 7 Classes
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3 font-semibold">Category</th>
                      <th className="py-2 px-3 font-semibold text-right">Count</th>
                      <th className="py-2 px-3 font-semibold text-right">Financial Discrepancy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {[
                      ["Missing Settlement", "missing_settlement_count", "missing_settlement_impact"],
                      ["Duplicate Settlement", "duplicate_settlement_count", "duplicate_settlement_impact"],
                      ["Amount Mismatch", "amount_mismatch_count", "amount_mismatch_impact"],
                      ["Refund Mismatch", "refund_mismatch_count", "refund_mismatch_impact"],
                      ["Fee Anomaly (Excess MDR)", "fee_anomaly_count", "fee_anomaly_impact"],
                      ["Delayed Settlement (SLA Breach)", "delayed_settlement_count", "delayed_settlement_impact"],
                      ["Orphan Settlement", "orphan_settlement_count", "orphan_settlement_impact"],
                    ].map(([title, cntKey, impKey]) => (
                      <tr key={title} className="hover:bg-slate-950/40">
                        <td className="py-2 px-3 font-sans text-slate-200">{title}</td>
                        <td className="py-2 px-3 text-right">{preview.exception_summary[cntKey] || 0}</td>
                        <td className="py-2 px-3 text-right text-rose-400 font-semibold">
                          {formatCurrency(preview.exception_summary[impKey] || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Top Priority Issues */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300">
                3. Top Prioritized Issues
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3">Severity</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Payment / Ref ID</th>
                      <th className="py-2 px-3 text-right">Impact</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {preview.top_issues.slice(0, 6).map((it) => (
                      <tr key={it.exception_id} className="hover:bg-slate-950/40">
                        <td className="py-2 px-3">
                          <span className="text-[10px] font-bold text-amber-400">{it.severity}</span>
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-200">{it.exception_type}</td>
                        <td className="py-2 px-3 text-blue-400">{it.payment_id || it.exception_id}</td>
                        <td className="py-2 px-3 text-right text-rose-400 font-semibold">{formatCurrency(it.amount_discrepancy)}</td>
                        <td className="py-2 px-3">{it.status || "OPEN"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 4: Investigation Lifecycle Status & Activity */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300">
                4. Investigation Status & Audit Activity
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Open</span>
                  <span className="text-sm font-bold text-rose-400">{preview.investigation_status.open}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Investigating</span>
                  <span className="text-sm font-bold text-amber-400">{preview.investigation_status.investigating}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Resolved</span>
                  <span className="text-sm font-bold text-emerald-400">{preview.investigation_status.resolved}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Resolution Rate</span>
                  <span className="text-sm font-bold text-blue-400">{preview.investigation_status.resolution_rate.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Section 5: AI Investigation Insights */}
            {preview.ai_insights.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>5. AI Investigation Diagnostic Summaries</span>
                </h3>

                <div className="space-y-2">
                  {preview.ai_insights.map((ins, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-blue-950/20 border border-blue-900/30 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-blue-300 font-semibold">
                        <span>{ins.exception_type} ({ins.payment_id})</span>
                        <span>{Math.round(ins.confidence * 100)}% Confidence</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed font-sans">{ins.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 6: Methodology & Ground Truth */}
            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed space-y-1">
              <span className="font-semibold text-slate-300 block">Audit Methodology & Ground Truth Statement</span>
              <p>{preview.methodology}</p>
            </div>

          </div>

          {/* Past Generated Reports History */}
          {history.length > 0 && (
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                <History className="w-4 h-4 text-blue-400" />
                <span>Recently Generated Audit Reports</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3">Report ID</th>
                      <th className="py-2 px-3">Created</th>
                      <th className="py-2 px-3">Generation Latency</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {history.map((rep) => (
                      <tr key={rep.report_id} className="hover:bg-slate-950/40">
                        <td className="py-2.5 px-3 text-blue-400 font-semibold">{rep.report_id}</td>
                        <td className="py-2.5 px-3 text-slate-400">{formatDate(rep.created_at)}</td>
                        <td className="py-2.5 px-3">{rep.generation_time_ms} ms</td>
                        <td className="py-2.5 px-3 text-right">
                          <a
                            href={getReportDownloadUrl(datasetId, rep.report_id)}
                            download
                            className="inline-flex items-center space-x-1 px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download PDF</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      ) : null}

    </div>
  );
}

export default function ReportsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading Financial Reports...</div>}>
        <ReportsContent />
      </Suspense>
    </AppShell>
  );
}
