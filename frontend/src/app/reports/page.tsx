"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Download,
  Printer,
  CheckCircle2,
  RefreshCw,
  Database,
  History,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Receipt
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
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { SeverityBadge, StatusBadge } from "@/components/ui/Badges";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/FeedbackStates";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { formatDate, formatNumber } from "@/lib/formatters";

const EXCEPTION_TITLES: Record<string, string> = {
  MISSING_SETTLEMENT: "Missing Settlement",
  DUPLICATE_SETTLEMENT: "Duplicate Settlement",
  AMOUNT_MISMATCH: "Amount Mismatch",
  REFUND_MISMATCH: "Refund Mismatch",
  UNEXPECTED_FEE: "Fee Anomaly (Excess MDR)",
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
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

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
    if (generatingPdf) return;
    setGeneratingPdf(true);
    setError(null);
    setSuccessBanner(null);
    try {
      const res = await generateReportPdf(datasetId, {
        severity: severityFilter,
        exception_type: typeFilter,
        status: statusFilter,
        date_preset: datePreset,
      });
      setSuccessBanner(`Audit-Ready Financial Report compiled successfully (${res.generation_time_ms} ms).`);
      await loadHistory();
      window.open(getReportDownloadUrl(datasetId, res.report_id), "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate financial report PDF.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (!datasetId) {
    return (
      <EmptyState
        icon={Database}
        title="No Financial Dataset Selected"
        description="Select a financial session to compile reconciliation reports."
        action={
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
          >
            Go to Dashboard
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Overview", href: `/dashboard?dataset_id=${datasetId}` },
          { label: "Reconciliation Reports", isCurrent: true },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Audit-Ready Reconciliation Reports
            </h1>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              Session: <strong className="text-slate-200">{datasetId}</strong>
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Compile institutional-grade reconciliation PDF audit packages and export formula-injection protected CSV ledgers.
          </p>
        </div>

        {/* Primary Report Generation & Export Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={generatingPdf}
            onClick={handleGeneratePdf}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] cursor-pointer disabled:opacity-50"
            aria-label="Generate PDF Financial Report"
          >
            {generatingPdf ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Compiling PDF Report...</span>
              </>
            ) : (
              <>
                <Printer className="w-3.5 h-3.5" />
                <span>Generate PDF Report</span>
              </>
            )}
          </button>

          <a
            href={getCsvExportUrl(datasetId, "exceptions")}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Success Notification */}
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

      {/* Localized Error state */}
      {error && <ErrorState message={error} onRetry={loadReportData} />}

      {/* Report Summary Preview Card */}
      {loading && !preview ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c121e] p-6 space-y-6 animate-pulse shadow-xl" aria-busy="true" aria-label="Loading report preview">
          <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
            <div className="space-y-2">
              <div className="h-3 w-32 rounded bg-slate-800/60" />
              <div className="h-6 w-64 rounded bg-slate-800/80" />
            </div>
            <div className="h-4 w-28 rounded bg-slate-800/40" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`rep-kpi-${i}`} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="h-3 w-20 rounded bg-slate-800/60" />
                <div className="h-6 w-28 rounded bg-slate-800/80" />
              </div>
            ))}
          </div>
          <div className="space-y-3 pt-2">
            <div className="h-12 rounded-xl bg-slate-900/60" />
            <div className="h-12 rounded-xl bg-slate-900/60" />
          </div>
        </div>
      ) : preview ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c121e] p-6 space-y-6 shadow-xl">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block font-semibold">
                Official Report Scope & Integrity
              </span>
              <h2 className="text-base font-bold text-white tracking-tight mt-0.5">
                Executive Reconciliation Package Preview
              </h2>
            </div>

            <div className="text-xs font-mono text-slate-400">
              Compiled: {formatDate(preview.generated_at)}
            </div>
          </div>

          {/* Key Financial KPIs matching Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-850">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">
                Total Gross Volume
              </span>
              <div className="pt-1">
                <FinancialAmount amount={preview.financial_overview.total_volume} size="lg" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-850">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">
                Expected Payout
              </span>
              <div className="pt-1">
                <FinancialAmount amount={preview.financial_overview.expected_settlement} size="lg" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-850">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">
                Actual Bank Payout
              </span>
              <div className="pt-1">
                <FinancialAmount amount={preview.financial_overview.actual_settlement} size="lg" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-850">
              <span className="text-[10px] font-mono uppercase text-rose-400 block font-semibold">
                Unexplained Difference
              </span>
              <div className="pt-1">
                <FinancialAmount amount={preview.financial_overview.unexplained_difference} size="lg" variant="danger" />
              </div>
            </div>
          </div>

          {/* Severity & Resolution Overview */}
          <div className="grid sm:grid-cols-2 gap-6 pt-2">
            
            {/* Severity breakdown */}
            <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-850 space-y-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 block">
                Discrepancy Severity Breakdown
              </span>
              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                {Object.entries(preview.severity_breakdown || {}).map(([sev, count]) => (
                  <div key={sev} className="flex justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">{sev}:</span>
                    <span className="text-white font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Investigation status */}
            <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-850 space-y-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 block">
                Investigation Lifecycle Resolution
              </span>
              <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[10px] text-rose-400 block font-semibold">OPEN</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">{preview.investigation_status?.open ?? 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[10px] text-amber-400 block font-semibold">INVESTIGATING</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">{preview.investigation_status?.investigating ?? 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[10px] text-emerald-400 block font-semibold">RESOLVED</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">{preview.investigation_status?.resolved ?? 0}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Methodology statement */}
          {preview.methodology && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed space-y-1">
              <span className="font-semibold text-slate-300 block">Deterministic Audit Methodology & Ground Truth Statement</span>
              <p>{preview.methodology}</p>
            </div>
          )}

        </div>
      ) : null}

      {/* Recent Reports History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
            <History className="w-4 h-4 text-blue-400" />
            <span>Compiled PDF Audit Packages</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">{history.length} Packages</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0c121e] overflow-hidden shadow-xl">
          {history.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-mono text-xs">
              No previous PDF reports compiled for this dataset. Click &ldquo;Generate PDF Report&rdquo; above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th scope="col" className="p-3.5 pl-5">Package ID</th>
                    <th scope="col" className="p-3.5">Compiled Date</th>
                    <th scope="col" className="p-3.5">Report Title</th>
                    <th scope="col" className="p-3.5">Status</th>
                    <th scope="col" className="p-3.5 text-right pr-5">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map((rep) => (
                    <tr key={rep.report_id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-3.5 pl-5 font-semibold text-slate-100">
                        {rep.report_id}
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {formatDate(rep.created_at)}
                      </td>
                      <td className="p-3.5 text-slate-400 font-sans">
                        {rep.report_title || "Reconciliation Audit Package"}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                          COMPILED
                        </span>
                      </td>
                      <td className="p-3.5 text-right pr-5">
                        <a
                          href={getReportDownloadUrl(datasetId, rep.report_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900 text-blue-300 text-xs font-sans font-medium transition-colors border border-blue-800/40"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default function ReportsPage() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingState message="Loading reconciliation reports..." />}>
        <ReportsContent />
      </Suspense>
    </AppShell>
  );
}
