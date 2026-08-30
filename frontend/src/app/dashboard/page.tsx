"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Search,
  Database,
  FileSpreadsheet,
  HelpCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Receipt
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
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { SeverityBadge, StatusBadge } from "@/components/ui/Badges";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/FeedbackStates";
import { formatDate, formatNumber } from "@/lib/formatters";

const EXCEPTION_TITLES: Record<string, string> = {
  MISSING_SETTLEMENT: "Missing Settlement",
  DUPLICATE_SETTLEMENT: "Duplicate Settlement",
  AMOUNT_MISMATCH: "Amount Mismatch",
  REFUND_MISMATCH: "Refund Mismatch",
  FEE_ANOMALY: "Fee Anomaly (Excess MDR)",
  DELAYED_SETTLEMENT: "Delayed Settlement (SLA Breach)",
  ORPHAN_SETTLEMENT: "Orphan Settlement",
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
      // 1. Run or fetch reconciliation summary
      let recSummary: ReconcileResponse;
      try {
        recSummary = await fetchReconciliationSummary(id);
      } catch {
        recSummary = await runReconciliation(id);
      }
      setSummary(recSummary);

      // 2. Fetch Exception Summary, Action Center Summary & Top Prioritized Issues concurrently
      const [excRes, actRes, prioRes] = await Promise.allSettled([
        fetchExceptionSummary(id),
        fetchActionCenterSummary(id),
        fetchPriorityQueue(id, { limit: 6 }),
      ]);

      if (excRes.status === "fulfilled") {
        setExcSummary(excRes.value);
      }
      if (actRes.status === "fulfilled") {
        setActionSummary(actRes.value);
      }
      if (prioRes.status === "fulfilled") {
        setTopExceptions(prioRes.value.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while loading this financial dataset.");
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
        },
      });
      router.push(`/dashboard?dataset_id=${gen.dataset_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to synthesize demo dataset.");
      setLoading(false);
    }
  };

  if (!datasetId && !loading) {
    return (
      <EmptyState
        icon={Database}
        title="No Financial Dataset Selected"
        description="Select an active financial session from the header, load the pre-generated 10,000-record benchmark, or upload CSV files."
        action={
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleCreateDemo(10000)}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Activity className="w-4 h-4" />
              <span>Load 10k Benchmark Demo</span>
            </button>
            <Link
              href="/upload"
              className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              <span>Upload CSV Dataset</span>
            </Link>
          </div>
        }
      />
    );
  }

  if (loading && !summary) {
    return (
      <LoadingState
        message="Loading financial overview..."
        subMessage="Reconciling captured payments against settled payouts"
        size="lg"
      />
    );
  }

  // Calculated Reconciled vs Unreconciled percentages directly from deterministic backend values
  const recRate = summary?.reconciliation_rate ?? 0;
  const unrecRate = Math.max(0, 100 - recRate);
  const unexplainedAmount = summary?.unexplained_difference ?? 0;
  const openCount = actionSummary?.open ?? (summary?.exception_count ?? 0);
  const investigatingCount = actionSummary?.investigating ?? 0;
  const resolvedCount = actionSummary?.resolved ?? 0;

  return (
    <div className="space-y-8">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Financial Health & Reconciliation
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Deterministic matching across payment captures, deductions, refunds, and bank settlements.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => datasetId && loadDashboardData(datasetId)}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition-colors cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh Overview</span>
        </button>
      </div>

      {/* Error State Banner */}
      {error && (
        <ErrorState
          message={error}
          onRetry={() => datasetId && loadDashboardData(datasetId)}
        />
      )}

      {/* 1. HERO DASHBOARD SECTION: "How much money is unexplained?" */}
      <div className="grid lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Main Hero Card */}
        <div className="lg:col-span-7 p-6 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                FINANCIAL HEALTH
              </span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              {formatNumber(summary?.total_transactions)} Transactions Processed
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Unexplained Amount
            </span>
            <div className="pt-1">
              <FinancialAmount
                amount={unexplainedAmount}
                size="3xl"
                variant={unexplainedAmount > 0 ? "danger" : "positive"}
              />
            </div>
            <p className="text-xs text-slate-400 pt-1">
              Net reconciliation difference between expected payout and actual settled bank funds.
            </p>
          </div>

          {/* Issue Breakdown Bar */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850">
              <span className="text-[10px] font-mono uppercase text-rose-400 block font-semibold">
                Open Issues
              </span>
              <span className="text-lg font-bold font-mono text-white">
                {formatNumber(openCount)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850">
              <span className="text-[10px] font-mono uppercase text-amber-400 block font-semibold">
                Investigating
              </span>
              <span className="text-lg font-bold font-mono text-white">
                {formatNumber(investigatingCount)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850">
              <span className="text-[10px] font-mono uppercase text-emerald-400 block font-semibold">
                Resolved
              </span>
              <span className="text-lg font-bold font-mono text-white">
                {formatNumber(resolvedCount)}
              </span>
            </div>
          </div>
        </div>

        {/* 2. FINANCIAL HEALTH INDICATOR: "Why is it unexplained?" */}
        <div className="lg:col-span-5 p-6 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
              Ledger Settlement Rate
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-400">
              {recRate.toFixed(1)}% Matched
            </span>
          </div>

          {/* Visual Percentage Bar */}
          <div className="space-y-3">
            <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, recRate))}%` }}
                title={`Reconciled: ${recRate.toFixed(1)}%`}
              />
              <div
                className="bg-rose-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, unrecRate))}%` }}
                title={`Unreconciled: ${unrecRate.toFixed(1)}%`}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Reconciled: <strong className="text-slate-200">{recRate.toFixed(1)}%</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Unreconciled: <strong className="text-slate-200">{unrecRate.toFixed(1)}%</strong></span>
              </div>
            </div>
          </div>

          {/* Settlement Totals */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Expected Settlement:</span>
              <FinancialAmount amount={summary?.expected_settlement} size="sm" />
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Actual Bank Payout:</span>
              <FinancialAmount amount={summary?.actual_settlement} size="sm" />
            </div>
            <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-850 font-semibold">
              <span className="text-rose-400">Unexplained Difference:</span>
              <FinancialAmount amount={summary?.unexplained_difference} size="sm" variant="danger" />
            </div>
          </div>

          <div className="pt-1">
            <Link
              href={`/investigate?dataset_id=${datasetId}`}
              className="w-full py-2 px-3 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/40 text-blue-300 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Ask LeakLens About This Gap</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        </div>

      </div>

      {/* 3. WHERE MONEY IS GETTING STUCK: "What should I investigate first?" */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
              <span>Where Money Is Getting Stuck</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                Top Priority
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              High-impact financial discrepancies prioritized for merchant dispute and investigation.
            </p>
          </div>

          <Link
            href={`/exceptions?dataset_id=${datasetId}`}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1 self-start sm:self-auto"
          >
            <span>View All Exceptions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Priority Table */}
        <div className="rounded-xl border border-slate-800 bg-[#0c121e] overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 pl-5">Financial Issue</th>
                  <th className="p-3.5">Payment ID</th>
                  <th className="p-3.5">Financial Impact</th>
                  <th className="p-3.5">Severity</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Age / Date</th>
                  <th className="p-3.5 text-right pr-5">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {topExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                      No unresolved discrepancies found in this dataset session.
                    </td>
                  </tr>
                ) : (
                  topExceptions.map((item) => (
                    <tr
                      key={item.exception_id}
                      className="hover:bg-slate-900/40 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/exceptions/${item.exception_id}?dataset_id=${datasetId}`)}
                    >
                      <td className="p-3.5 pl-5 font-sans">
                        <div className="font-semibold text-slate-100">
                          {EXCEPTION_TITLES[item.exception_type] || item.exception_type}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 truncate max-w-xs">
                          {item.exception_id}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-300">
                        {item.payment_id || <span className="text-slate-600">N/A</span>}
                      </td>

                      <td className="p-3.5">
                        <FinancialAmount
                          amount={item.amount_discrepancy}
                          size="sm"
                          variant="danger"
                        />
                      </td>

                      <td className="p-3.5">
                        <SeverityBadge severity={item.severity} size="sm" />
                      </td>

                      <td className="p-3.5">
                        <StatusBadge status={item.status} size="sm" />
                      </td>

                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {formatDate(item.created_at)}
                      </td>

                      <td className="p-3.5 text-right pr-5">
                        <Link
                          href={`/exceptions/${item.exception_id}?dataset_id=${datasetId}`}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-950/60 hover:bg-blue-900 text-blue-300 text-xs font-sans font-medium transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>Investigate</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingState message="Loading financial overview..." />}>
        <DashboardContent />
      </Suspense>
    </AppShell>
  );
}
