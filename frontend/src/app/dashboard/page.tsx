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
  ArrowRight,
  RefreshCw,
  Search,
  DollarSign,
  PieChart,
  BarChart3,
  ShieldAlert,
  ArrowUpRight,
  Database,
  FileSpreadsheet
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  runReconciliation,
  fetchReconciliationSummary,
  fetchExceptionSummary,
  fetchPriorityQueue,
  fetchActionCenterSummary,
  generateSyntheticDataset,
  ReconcileResponse,
  ExceptionSummaryResponse,
  ExceptionItem,
  ActionCenterSummary
} from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";

const EXCEPTION_TITLES: Record<string, string> = {
  MISSING_SETTLEMENT: "Missing Settlement",
  DUPLICATE_SETTLEMENT: "Duplicate Settlement",
  AMOUNT_MISMATCH: "Amount Mismatch",
  REFUND_MISMATCH: "Refund Mismatch",
  FEE_ANOMALY: "Fee Anomaly",
  DELAYED_SETTLEMENT: "Delayed Settlement",
  ORPHAN_SETTLEMENT: "Orphan Settlement",
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-800/60" },
  HIGH: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-800/60" },
  MEDIUM: { bg: "bg-blue-950/60", text: "text-blue-400", border: "border-blue-800/60" },
  LOW: { bg: "bg-slate-800", text: "text-slate-400", border: "border-slate-700" },
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const datasetId = searchParams.get("dataset_id") || "";

  const [summary, setSummary] = useState<ReconcileResponse | null>(null);
  const [excSummary, setExcSummary] = useState<ExceptionSummaryResponse | null>(null);
  const [actionSummary, setActionSummary] = useState<ActionCenterSummary | null>(null);
  const [topExceptions, setTopExceptions] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (datasetId) {
      loadDashboardData(datasetId);
    }
  }, [datasetId]);

  const loadDashboardData = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Run / Fetch reconciliation summary
      let recSummary: ReconcileResponse;
      try {
        recSummary = await fetchReconciliationSummary(id);
      } catch {
        recSummary = await runReconciliation(id);
      }
      setSummary(recSummary);

      // 2. Fetch Exception Summary
      try {
        const eSummary = await fetchExceptionSummary(id);
        setExcSummary(eSummary);
      } catch {
        // Handled
      }

      // 3. Fetch Action Center Summary & Prioritized Issues
      try {
        const [actSum, prioQueue] = await Promise.all([
          fetchActionCenterSummary(id),
          fetchPriorityQueue(id, { limit: 5 }),
        ]);
        setActionSummary(actSum);
        setTopExceptions(prioQueue.items);
      } catch {
        // Handled
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDemo = async (count: number = 10000) => {
    setLoading(true);
    setError(null);
    try {
      const gen = await generateSyntheticDataset({
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
        }
      });
      router.push(`/dashboard?dataset_id=${gen.dataset_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to synthesize demo dataset.");
      setLoading(false);
    }
  };

  if (!datasetId && !loading) {
    return (
      <div className="p-12 rounded-xl border border-dashed border-slate-800 bg-[#0c121e]/40 flex flex-col items-center justify-center text-center space-y-4">
        <Database className="w-12 h-12 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-200">No Financial Dataset Selected</h2>
        <p className="text-xs text-slate-400 max-w-md">
          Select an active session from the header dropdown, load the official 10,000-record benchmark, or upload CSV files.
        </p>
        <div className="flex gap-3 pt-2">
          <Link
            href="/upload"
            className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            <span>Upload CSV Dataset</span>
          </Link>
          <button
            type="button"
            onClick={() => handleCreateDemo(10000)}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center space-x-2 cursor-pointer"
          >
            <Activity className="w-4 h-4" />
            <span>Load 10k Benchmark Demo</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Merchant Settlement Overview</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Deterministic reconciliation analysis across payment captures, gateway fees, partial refunds, and bank payouts.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => datasetId && loadDashboardData(datasetId)}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition-colors cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-16 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col items-center justify-center text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-sm font-semibold text-white">Aggregating Financial Intelligence...</p>
          <p className="text-xs text-slate-500 font-mono">Running deterministic verification across transactions and exceptions</p>
        </div>
      )}

      {/* Overview Cards */}
      {!loading && summary && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Most Important Metric — Potential Discrepancy */}
            <div className="p-5 rounded-xl bg-gradient-to-b from-rose-950/30 to-slate-950 border border-rose-900/50 flex flex-col justify-between space-y-3 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
                <span className="flex items-center space-x-1.5">
                  <TrendingDown className="w-4 h-4" />
                  <span>Potential Discrepancy</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono">
                  {summary.exception_count} Exceptions
                </span>
              </div>
              <div>
                <div className="text-3xl font-bold font-mono text-white tracking-tight">
                  {formatCurrency(summary.unexplained_difference)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Settlement variance requiring merchant investigation
                </p>
              </div>
              <div className="pt-2 border-t border-rose-950/60 flex items-center justify-between text-[11px]">
                <Link
                  href={`/exceptions?dataset_id=${datasetId}&severity=CRITICAL`}
                  className="text-rose-400 hover:text-rose-300 font-medium flex items-center space-x-1"
                >
                  <span>Inspect Critical Issues</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Card 2: Total Payment Volume */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col justify-between space-y-3">
              <span className="text-xs text-slate-400 font-medium">Total Processed Volume</span>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {formatCurrency(summary.total_volume)}
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                  {formatNumber(summary.total_transactions)} Total Transactions
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <Link href={`/transactions?dataset_id=${datasetId}`} className="text-blue-400 hover:text-blue-300 flex items-center space-x-1">
                  <span>View All Transactions</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Card 3: Reconciliation Health Rate */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col justify-between space-y-3">
              <span className="text-xs text-slate-400 font-medium">Reconciliation Health</span>
              <div>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {formatPercent(summary.reconciliation_rate)}
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                  {formatNumber(summary.matched_count)} Reconciled Cleanly
                </p>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, summary.reconciliation_rate)}%` }}
                />
              </div>
            </div>

            {/* Card 4: Expected vs Actual Settlement */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col justify-between space-y-3">
              <span className="text-xs text-slate-400 font-medium">Net Settlement Payout</span>
              <div>
                <div className="text-2xl font-bold font-mono text-blue-400">
                  {formatCurrency(summary.actual_settlement)}
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                  Expected: {formatCurrency(summary.expected_settlement)}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono">Engine Latency</span>
                <span className="text-slate-300 font-mono">{summary.duration_ms} ms</span>
              </div>
            </div>

          </div>

          {/* Middle Row: Settlement Comparison & Breakdown */}
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Settlement Comparison Card */}
            <div className="lg:col-span-1 p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <span>Settlement Truth Comparison</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Comparing gross captured volume minus deductions against actual bank settlement credits.
                </p>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Expected Settlement</span>
                  <span className="font-bold text-blue-400">{formatCurrency(summary.expected_settlement)}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Actual Bank Credit</span>
                  <span className="font-bold text-slate-200">{formatCurrency(summary.actual_settlement)}</span>
                </div>
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/40 flex items-center justify-between">
                  <span className="text-rose-400 font-medium">Variance / Leakage</span>
                  <span className="font-bold text-rose-300">{formatCurrency(summary.unexplained_difference)}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/50 text-[11px] text-slate-400 leading-relaxed">
                Formula: <span className="font-mono text-slate-300">Net = Payment - Refunds - Fees - Taxes</span>
              </div>
            </div>

            {/* Exception Breakdown Horizontal List / Bars */}
            <div className="lg:col-span-2 p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <span>Exception Class Breakdown</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Distribution across the 7 deterministic exception categories.
                  </p>
                </div>
                <Link
                  href={`/exceptions?dataset_id=${datasetId}`}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                >
                  <span>View All ({summary.exception_count})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2.5 pt-1">
                {Object.entries(summary.exception_breakdown).length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-mono">
                    Zero exceptions flagged. All transactions reconciled cleanly.
                  </div>
                ) : (
                  Object.entries(summary.exception_breakdown).map(([typeKey, count]) => {
                    const pct = summary.exception_count > 0 ? (count / summary.exception_count) * 100 : 0;
                    return (
                      <div key={typeKey} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-300 font-sans">{EXCEPTION_TITLES[typeKey] || typeKey}</span>
                          <span className="text-slate-400 font-mono">
                            {count} <span className="text-[10px] text-slate-500">({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/60">
                          <div
                            className="bg-blue-500 h-full rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Priority Attention Section: "What needs my attention?" */}
          <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>What needs my attention?</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  High-priority financial anomalies sorted by deterministic severity and monetary impact.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                {actionSummary && (
                  <div className="flex items-center space-x-1 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-400 font-semibold">
                      {actionSummary.open} Open
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-400 font-semibold">
                      {actionSummary.investigating} In Review
                    </span>
                  </div>
                )}

                <Link
                  href={`/action-center?dataset_id=${datasetId}`}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1 font-semibold"
                >
                  <span>Open Action Center</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {topExceptions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                No critical or high-severity exceptions detected in this dataset.
              </div>
            ) : (
              <div className="grid gap-3">
                {topExceptions.map((exc) => {
                  const sevStyle = SEVERITY_COLORS[exc.severity] || SEVERITY_COLORS.MEDIUM;
                  return (
                    <div
                      key={exc.exception_id}
                      className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${sevStyle.bg} ${sevStyle.text} ${sevStyle.border}`}>
                            {exc.severity}
                          </span>
                          <span className="font-semibold text-xs text-white">
                            {EXCEPTION_TITLES[exc.exception_type] || exc.exception_type}
                          </span>
                          {exc.payment_id && (
                            <span className="text-xs font-mono text-blue-400">
                              {exc.payment_id}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {exc.description}
                        </p>
                      </div>

                      <div className="flex items-center space-x-4 self-end sm:self-center shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 font-mono block">Potential Impact</span>
                          <span className="font-bold text-sm font-mono text-rose-400">
                            {formatCurrency(exc.amount_discrepancy)}
                          </span>
                        </div>

                        <Link
                          href={`/exceptions/${exc.exception_id}?dataset_id=${datasetId}`}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1 transition-colors"
                        >
                          <span>View Details</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading Financial Overview...</div>}>
        <DashboardContent />
      </Suspense>
    </AppShell>
  );
}
