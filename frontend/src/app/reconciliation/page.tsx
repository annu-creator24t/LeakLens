"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  Eye,
  X,
  Clock,
  ArrowRight,
  Database,
  Sliders,
  DollarSign,
  FileSpreadsheet,
  Cpu
} from "lucide-react";
import {
  runReconciliation,
  fetchReconciliationSummary,
  fetchReconciliationExceptions,
  fetchExceptionDetail,
  generateSyntheticDataset,
  ReconcileResponse,
  ExceptionItem
} from "@/lib/api";

const EXCEPTION_LABELS: Record<string, string> = {
  ALL: "All Types",
  MISSING_SETTLEMENT: "Missing Settlement",
  DUPLICATE_SETTLEMENT: "Duplicate Settlement",
  AMOUNT_MISMATCH: "Amount Mismatch",
  REFUND_MISMATCH: "Refund Mismatch",
  UNEXPECTED_FEE: "Fee Anomaly",
  DELAYED_SETTLEMENT: "Delayed Settlement",
  ORPHAN_SETTLEMENT: "Orphan Settlement",
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-rose-950/60 text-rose-300 border-rose-800/60",
  HIGH: "bg-amber-950/60 text-amber-300 border-amber-800/60",
  MEDIUM: "bg-blue-950/60 text-blue-300 border-blue-800/60",
  LOW: "bg-slate-800 text-slate-300 border-slate-700",
};

function ReconciliationDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlDatasetId = searchParams.get("dataset_id");

  const [datasetId, setDatasetId] = useState<string | null>(urlDatasetId);
  const [summary, setSummary] = useState<ReconcileResponse | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [totalExceptions, setTotalExceptions] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const limit = 25;

  // Inspect Modal
  const [selectedException, setSelectedException] = useState<ExceptionItem | null>(null);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);

  // Trigger reconciliation when datasetId changes
  useEffect(() => {
    if (datasetId) {
      handleRunReconcile(datasetId);
    }
  }, [datasetId]);

  // Refetch exceptions when filters change
  useEffect(() => {
    if (datasetId && summary) {
      loadExceptions(datasetId);
    }
  }, [severityFilter, typeFilter, searchQuery, page, datasetId, summary]);

  const handleRunReconcile = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await runReconciliation(id);
      setSummary(res);
      await loadExceptions(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run reconciliation.");
    } finally {
      setLoading(false);
    }
  };

  const loadExceptions = async (id: string) => {
    try {
      const data = await fetchReconciliationExceptions(id, {
        severity: severityFilter,
        exception_type: typeFilter,
        search: searchQuery,
        page: page,
        limit: limit,
      });
      setExceptions(data.items);
      setTotalExceptions(data.total);
    } catch (err) {
      console.error("Failed to load exceptions", err);
    }
  };

  const handleOpenDetail = async (exc: ExceptionItem) => {
    setSelectedException(exc);
    setInspectLoading(true);
    if (datasetId) {
      try {
        const fullDetail = await fetchExceptionDetail(datasetId, exc.exception_id);
        setSelectedException(fullDetail);
      } catch (err) {
        console.error(err);
      } finally {
        setInspectLoading(false);
      }
    }
  };

  const handleLoadDemoDataset = async (count: number = 1000) => {
    setLoading(true);
    setError(null);
    try {
      const genRes = await generateSyntheticDataset({
        transaction_count: count,
        anomaly_rate: 0.05,
        seed: 12345,
        merchant_id: "M001",
        anomalies: {
          missing_settlement: true,
          duplicate_settlement: true,
          amount_mismatch: true,
          refund_mismatch: true,
          fee_anomaly: true,
          delayed_settlement: true,
          orphan_settlement: true,
        },
      });
      setDatasetId(genRes.dataset_id);
      router.replace(`/reconciliation?dataset_id=${genRes.dataset_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate demo dataset.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
              <span>Deterministic Settlement Reconciliation</span>
              <Layers className="w-5 h-5 text-blue-400" />
            </h1>
            {datasetId && (
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-blue-950/60 border border-blue-800/50 text-blue-300">
                Session: {datasetId}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Auditable mathematical verification comparing payment capture, refund adjustments, fee deductions, and bank settlements.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {datasetId && (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRunReconcile(datasetId)}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
              <span>Re-run Reconciliation</span>
            </button>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => handleLoadDemoDataset(1000)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Load 1k Benchmark Demo</span>
          </button>
        </div>
      </div>

      {/* Error Message Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton / State */}
      {loading && (
        <div className="p-12 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col items-center justify-center text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-sm font-semibold text-white">Running Deterministic Reconciliation Engine...</p>
          <p className="text-xs text-slate-500 font-mono">Cross-referencing payment IDs, SLA windows, and fee slabs</p>
        </div>
      )}

      {/* Empty State when no dataset is selected */}
      {!loading && !summary && (
        <div className="p-12 rounded-xl border border-dashed border-slate-800 bg-[#0c121e]/40 flex flex-col items-center justify-center text-center space-y-4">
          <Database className="w-12 h-12 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-200">No Reconciled Session Loaded</h2>
          <p className="text-xs text-slate-400 max-w-md">
            Upload merchant CSV files in the uploader or click below to synthesize a live 1,000-transaction financial benchmark.
          </p>
          <div className="flex gap-3 pt-2">
            <Link
              href="/upload"
              className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              <span>Upload CSV Files</span>
            </Link>
            <button
              type="button"
              onClick={() => handleLoadDemoDataset(1000)}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center space-x-2"
            >
              <Activity className="w-4 h-4" />
              <span>Load 1k Benchmark Demo</span>
            </button>
          </div>
        </div>
      )}

      {/* Reconciled Summary KPIs */}
      {!loading && summary && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* KPI 1: Prominent Discrepancy Hero Card */}
            <div className="p-5 rounded-xl bg-rose-950/20 border border-rose-900/40 relative overflow-hidden flex flex-col justify-between space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
                <span className="flex items-center space-x-1.5">
                  <TrendingDown className="w-4 h-4" />
                  <span>Unexplained Discrepancy</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/50 text-rose-300 font-mono">
                  {summary.exception_count} Exceptions
                </span>
              </div>
              <div className="text-2xl lg:text-3xl font-bold font-mono text-white tracking-tight">
                ₹{summary.unexplained_difference.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">
                Settlement credit variance requiring merchant attention
              </p>
            </div>

            {/* KPI 2: Total Volume */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col justify-between space-y-2">
              <span className="text-xs text-slate-400 font-medium">Total Captured Volume</span>
              <div className="text-xl lg:text-2xl font-bold font-mono text-slate-100">
                ₹{summary.total_volume.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {summary.total_transactions.toLocaleString()} total transactions
              </p>
            </div>

            {/* KPI 3: Reconciliation Rate */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col justify-between space-y-2">
              <span className="text-xs text-slate-400 font-medium">Reconciliation Match Rate</span>
              <div className="text-xl lg:text-2xl font-bold font-mono text-emerald-400">
                {summary.reconciliation_rate.toFixed(2)}%
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {summary.matched_count.toLocaleString()} matched cleanly
              </p>
            </div>

            {/* KPI 4: Expected vs Actual */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col justify-between space-y-2">
              <span className="text-xs text-slate-400 font-medium">Expected Settlement</span>
              <div className="text-xl lg:text-2xl font-bold font-mono text-blue-400">
                ₹{summary.expected_settlement.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Actual: ₹{summary.actual_settlement.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* KPI 5: Performance Latency */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col justify-between space-y-2">
              <span className="text-xs text-slate-400 font-medium">Processing Time</span>
              <div className="text-xl lg:text-2xl font-bold font-mono text-slate-200">
                {summary.duration_ms} ms
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Deterministic O(N) execution
              </p>
            </div>
          </div>

          {/* Exception Triage Queue Section */}
          <div className="rounded-xl border border-slate-800 bg-[#0c121e] space-y-4 p-6">
            
            {/* Section Header & Filter Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight flex items-center space-x-2">
                  <span>Exception Priority Triage Queue</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {totalExceptions} Items Found
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Filter exceptions by severity or exception class to isolate specific payment gateway anomalies.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search payment ID or description..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Filter Pills Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 mr-2">
                <Filter className="w-3.5 h-3.5" />
                <span>Severity:</span>
              </div>
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => {
                    setSeverityFilter(sev);
                    setPage(1);
                  }}
                  className={`text-xs px-2.5 py-1 rounded font-mono border transition-colors cursor-pointer ${
                    severityFilter === sev
                      ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                      : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {sev}
                </button>
              ))}

              <div className="h-4 w-px bg-slate-800 mx-2" />

              <div className="flex items-center space-x-1.5 text-xs text-slate-400 mr-2">
                <span>Type:</span>
              </div>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded px-2.5 py-1 font-mono focus:outline-none focus:border-blue-500"
              >
                {Object.entries(EXCEPTION_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Exceptions Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-800/80">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/90 text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-3 pl-4">Exception ID</th>
                    <th className="p-3">Payment ID</th>
                    <th className="p-3">Exception Class</th>
                    <th className="p-3 text-right">Expected</th>
                    <th className="p-3 text-right">Actual</th>
                    <th className="p-3 text-right">Discrepancy</th>
                    <th className="p-3 text-center">Severity</th>
                    <th className="p-3 text-center pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {exceptions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No exceptions match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    exceptions.map((exc) => (
                      <tr key={exc.exception_id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 pl-4 font-bold text-slate-300 truncate max-w-[140px]">
                          {exc.exception_id}
                        </td>
                        <td className="p-3 text-blue-400">
                          {exc.payment_id || "N/A"}
                        </td>
                        <td className="p-3 text-slate-300">
                          {EXCEPTION_LABELS[exc.exception_type] || exc.exception_type}
                        </td>
                        <td className="p-3 text-right text-slate-400">
                          ₹{exc.expected_settlement.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-slate-400">
                          ₹{exc.actual_settlement.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-bold text-rose-400">
                          ₹{exc.amount_discrepancy.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${SEVERITY_COLORS[exc.severity] || "bg-slate-800 text-slate-400"}`}>
                            {exc.severity}
                          </span>
                        </td>
                        <td className="p-3 text-center pr-4">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(exc)}
                            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                            <span>Audit</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalExceptions > limit && (
              <div className="flex items-center justify-between pt-3 text-xs text-slate-400">
                <span>
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalExceptions)} of {totalExceptions} exceptions
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white"
                  >
                    Previous
                  </button>
                  <span className="font-mono text-white px-2">Page {page}</span>
                  <button
                    type="button"
                    disabled={page * limit >= totalExceptions}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Exception Drill-Down Audit Modal / Drawer */}
      {selectedException && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c121e] border border-slate-700/80 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Exception Evidence Audit</h3>
                  <span className="text-xs text-slate-400 font-mono">{selectedException.exception_id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedException(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mathematical Truth Card */}
            <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-mono">
                Deterministic Financial Formula Breakdown
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-slate-950/50 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500">Expected</span>
                  <p className="font-bold text-blue-400">₹{selectedException.expected_settlement.toFixed(2)}</p>
                </div>
                <div className="p-2 rounded bg-slate-950/50 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500">Actual Credit</span>
                  <p className="font-bold text-slate-200">₹{selectedException.actual_settlement.toFixed(2)}</p>
                </div>
                <div className="p-2 rounded bg-rose-950/30 border border-rose-900/40">
                  <span className="text-[10px] text-rose-400">Discrepancy</span>
                  <p className="font-bold text-rose-300">₹{selectedException.amount_discrepancy.toFixed(2)}</p>
                </div>
                <div className="p-2 rounded bg-slate-950/50 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500">Severity</span>
                  <p className="font-bold text-amber-300">{selectedException.severity}</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 pt-1 leading-relaxed">
                {selectedException.description}
              </p>
            </div>

            {/* Chronological Lifecycle Timeline */}
            <div className="space-y-3">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-mono">
                Transaction Lifecycle Timeline
              </span>
              <div className="space-y-2 relative pl-4 border-l-2 border-slate-800">
                {selectedException.timeline?.map((step, idx) => (
                  <div key={idx} className="relative space-y-0.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -left-[21px] top-1" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{step.event}</span>
                      <span className="text-[10px] font-mono text-slate-500">{step.timestamp || "Event logged"}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">{step.details}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence Payload */}
            <div className="space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-mono">
                Structured Evidence Packet (Auditable Proof)
              </span>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-300 text-[11px] font-mono overflow-x-auto border border-slate-800/80">
                {JSON.stringify(selectedException.evidence, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedException(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col justify-between fintech-grid">
      {/* Top Nav */}
      <header className="border-b border-slate-800/80 bg-[#080b11]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-white tracking-tight">LEAKLENS</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-300 text-sm font-medium">Reconciliation Dashboard</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/generator"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors border border-blue-900/50 px-3 py-1.5 rounded-lg bg-blue-950/40"
            >
              Benchmark Generator
            </Link>
            <Link
              href="/upload"
              className="text-xs text-slate-400 hover:text-white border border-slate-800 bg-slate-900 px-3 py-1.5 rounded-lg transition-colors"
            >
              Upload Data
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading Reconciliation Workspace...</div>}>
        <ReconciliationDashboard />
      </Suspense>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© 2026 LeakLens. Razorpay AI Buildathon — Track 04: AI Finance Controller. Phase 4 Deterministic Engine.</p>
      </footer>
    </div>
  );
}
