"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  ArrowRight,
  Database,
  CheckSquare,
  Square,
  XCircle,
  Play,
  FileText
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchActionCenterSummary,
  fetchPriorityQueue,
  executeBulkAction,
  ActionCenterSummary,
  ExceptionItem
} from "@/lib/api";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { SeverityBadge, StatusBadge } from "@/components/ui/Badges";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/FeedbackStates";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
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

function ActionCenterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const datasetId = searchParams.get("dataset_id") || "";
  const initialStatus = searchParams.get("status") || "OPEN";
  const initialSeverity = searchParams.get("severity") || "ALL";
  const initialSearch = searchParams.get("search") || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  const [summary, setSummary] = useState<ActionCenterSummary | null>(null);
  const [items, setItems] = useState<ExceptionItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [severityFilter, setSeverityFilter] = useState<string>(initialSeverity);
  const [search, setSearch] = useState<string>(initialSearch);
  const [page, setPage] = useState<number>(initialPage);
  const limit = 15;

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);
  const [bulkModalAction, setBulkModalAction] = useState<"START" | "IGNORE" | null>(null);

  useEffect(() => {
    if (datasetId) {
      loadData();
    }
  }, [datasetId, statusFilter, severityFilter, search, page]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, queueData] = await Promise.all([
        fetchActionCenterSummary(datasetId),
        fetchPriorityQueue(datasetId, {
          status: statusFilter,
          severity: severityFilter,
          search: search.trim() || undefined,
          page,
          limit,
        }),
      ]);
      setSummary(sumData);
      setItems(queueData.items);
      setTotal(queueData.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Action Center items.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.exception_id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirmBulkAction = async (note: string) => {
    if (!bulkModalAction || selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      await executeBulkAction(datasetId, selectedIds, bulkModalAction, note);
      setSuccessBanner(`Bulk action (${bulkModalAction}) completed for ${selectedIds.length} items.`);
      setBulkModalAction(null);
      setSelectedIds([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setBulkLoading(false);
    }
  };

  if (!datasetId) {
    return (
      <EmptyState
        icon={Database}
        title="No Financial Dataset Selected"
        description="Select a financial session to view Action Center queues."
        action={
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            Go to Dashboard
          </Link>
        }
      />
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Overview", href: `/dashboard?dataset_id=${datasetId}` },
          { label: "Action Center", isCurrent: true },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span>What Needs Your Attention?</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Prioritized by severity, financial impact and age.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadData}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition-colors cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Success Notification */}
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

      {/* Summary Metrics: Open, Investigating, Resolved */}
      <div className="grid grid-cols-3 gap-4">
        
        {/* Open */}
        <div
          onClick={() => {
            setStatusFilter("OPEN");
            setPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "OPEN"
              ? "border-rose-700 bg-rose-950/30"
              : "border-slate-800 bg-[#0c121e] hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-rose-400">
              Open
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {formatNumber(summary?.open ?? 0)}
          </div>
          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
            Requires initial review
          </span>
        </div>

        {/* Investigating */}
        <div
          onClick={() => {
            setStatusFilter("INVESTIGATING");
            setPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "INVESTIGATING"
              ? "border-amber-700 bg-amber-950/30"
              : "border-slate-800 bg-[#0c121e] hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-amber-400">
              Investigating
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {formatNumber(summary?.investigating ?? 0)}
          </div>
          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
            Evidence under analysis
          </span>
        </div>

        {/* Resolved */}
        <div
          onClick={() => {
            setStatusFilter("RESOLVED");
            setPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "RESOLVED"
              ? "border-emerald-700 bg-emerald-950/30"
              : "border-slate-800 bg-[#0c121e] hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-emerald-400">
              Resolved
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {formatNumber(summary?.resolved ?? 0)}
          </div>
          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
            Audit note recorded
          </span>
        </div>

      </div>

      {/* Filter and Bulk Action Toolbar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Payment ID or Exception ID..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors font-mono"
          />
        </div>

        {/* Severity and Bulk Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by Severity"
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono outline-none focus:border-blue-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Bulk Action Buttons */}
          {selectedIds.length > 0 && (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <span className="text-xs font-mono text-blue-400 font-semibold">
                {selectedIds.length} selected
              </span>

              <button
                type="button"
                onClick={() => setBulkModalAction("START")}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Start Investigation
              </button>

              <button
                type="button"
                onClick={() => setBulkModalAction("IGNORE")}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors cursor-pointer"
              >
                Ignore
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* Priority Queue Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0c121e] overflow-hidden shadow-lg">
        {loading ? (
          <LoadingState
            message="Loading prioritized issue queue..."
            subMessage="Sorting by severity, impact, and age"
            size="md"
          />
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            No items in this queue matching the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 pl-4 w-10">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-slate-400 hover:text-white"
                      title="Select all"
                    >
                      {selectedIds.length === items.length && items.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-3.5">Financial Issue</th>
                  <th className="p-3.5">Payment ID</th>
                  <th className="p-3.5">Financial Impact</th>
                  <th className="p-3.5">Severity</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Age / Date</th>
                  <th className="p-3.5 text-right pr-5">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {items.map((item) => {
                  const isSelected = selectedIds.includes(item.exception_id);

                  return (
                    <tr
                      key={item.exception_id}
                      className={`hover:bg-slate-900/40 transition-colors group cursor-pointer ${
                        isSelected ? "bg-blue-950/20" : ""
                      }`}
                      onClick={() => router.push(`/exceptions/${item.exception_id}?dataset_id=${datasetId}`)}
                    >
                      <td className="p-3.5 pl-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(item.exception_id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="p-3.5 font-sans">
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
                          <span>Brief</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div>
              Showing page <strong className="text-slate-200">{page}</strong> of <strong className="text-slate-200">{totalPages}</strong>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Bulk Action Confirm Dialog */}
      <ConfirmDialog
        isOpen={bulkModalAction !== null}
        title={`Execute bulk ${bulkModalAction === "START" ? "Investigation" : "Ignore"} on ${selectedIds.length} items?`}
        description="Provide a mandatory note for the audit ledger to apply across all selected exceptions."
        confirmLabel={`Apply to ${selectedIds.length} Items`}
        loading={bulkLoading}
        onConfirm={handleConfirmBulkAction}
        onCancel={() => setBulkModalAction(null)}
      />

    </div>
  );
}

export default function ActionCenterPage() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingState message="Loading Action Center..." />}>
        <ActionCenterContent />
      </Suspense>
    </AppShell>
  );
}
