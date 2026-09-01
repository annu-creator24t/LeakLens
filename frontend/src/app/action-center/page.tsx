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
  FileText,
  X,
  Filter,
  Activity,
  Layers
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
  UNEXPECTED_FEE: "Fee Anomaly (Excess MDR)",
  DELAYED_SETTLEMENT: "Delayed Settlement (SLA Breach)",
  ORPHAN_SETTLEMENT: "Orphan Settlement",
};

const SEVERITY_FILTERS = [
  { value: "ALL", label: "All Severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

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

  const updateUrl = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === "ALL" || v === "" || (k === "page" && v === 1)) {
        params.delete(k);
      } else {
        params.set(k, String(v));
      }
    });
    router.replace(`/action-center?${params.toString()}`);
  };

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

  const handleStatusTabChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setSelectedIds([]);
    setPage(1);
    updateUrl({ status: newStatus, page: 1 });
  };

  const handleSeverityChange = (newSev: string) => {
    setSeverityFilter(newSev);
    setPage(1);
    updateUrl({ severity: newSev, page: 1 });
  };

  const handleSearchChange = (q: string) => {
    setSearch(q);
    setPage(1);
    updateUrl({ search: q, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrl({ page: newPage });
  };

  const handleResetFilters = () => {
    setSeverityFilter("ALL");
    setSearch("");
    setPage(1);
    updateUrl({ severity: "ALL", search: "", page: 1 });
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
      setSuccessBanner(`Bulk action (${bulkModalAction}) recorded on immutable audit ledger for ${selectedIds.length} items.`);
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
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
          >
            Go to Dashboard
          </Link>
        }
      />
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;
  const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);
  const isFiltered = severityFilter !== "ALL" || search.trim() !== "";

  return (
    <div className="space-y-6">
      
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: `/dashboard?dataset_id=${datasetId}` },
          { label: "Action Center", isCurrent: true },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Financial Operations Action Center
            </h1>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              Dataset: <strong className="text-slate-200">{datasetId.length > 20 ? `LL-${datasetId.slice(-6).toUpperCase()}` : datasetId}</strong>
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Institutional triage control room for reviewing, investigating, and resolving financial exceptions with audit logs.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadData}
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition-colors cursor-pointer self-start md:self-auto shadow-sm"
          aria-label="Refresh Action Center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh Queue</span>
        </button>
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

      {/* Summary Metrics Tabs: Open, Investigating, Resolved */}
      <div className="grid grid-cols-3 gap-4">
        
        {/* Open Card */}
        <button
          type="button"
          onClick={() => handleStatusTabChange("OPEN")}
          className={`p-4 rounded-2xl border transition-all text-left cursor-pointer shadow-md ${
            statusFilter === "OPEN"
              ? "border-rose-600 bg-rose-950/30 ring-1 ring-rose-500/50"
              : "border-slate-800 bg-[#0c121e] hover:border-slate-700 hover:bg-slate-900/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400">
              Open Queue
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {formatNumber(summary?.open ?? 0)}
          </div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">
            Requires initial review & triage
          </span>
        </button>

        {/* Investigating Card */}
        <button
          type="button"
          onClick={() => handleStatusTabChange("INVESTIGATING")}
          className={`p-4 rounded-2xl border transition-all text-left cursor-pointer shadow-md ${
            statusFilter === "INVESTIGATING"
              ? "border-amber-600 bg-amber-950/30 ring-1 ring-amber-500/50"
              : "border-slate-800 bg-[#0c121e] hover:border-slate-700 hover:bg-slate-900/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
              Investigating
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-sm" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {formatNumber(summary?.investigating ?? 0)}
          </div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">
            Evidence under analytical review
          </span>
        </button>

        {/* Resolved Card */}
        <button
          type="button"
          onClick={() => handleStatusTabChange("RESOLVED")}
          className={`p-4 rounded-2xl border transition-all text-left cursor-pointer shadow-md ${
            statusFilter === "RESOLVED"
              ? "border-emerald-600 bg-emerald-950/30 ring-1 ring-emerald-500/50"
              : "border-slate-800 bg-[#0c121e] hover:border-slate-700 hover:bg-slate-900/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              Resolved
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {formatNumber(summary?.resolved ?? 0)}
          </div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">
            Audit note recorded & cleared
          </span>
        </button>

      </div>

      {/* Filter and Bulk Action Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-[#0c121e] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-md">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by Payment ID or Exception ID..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors font-mono"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Severity and Bulk Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => handleSeverityChange(e.target.value)}
              aria-label="Filter queue by severity"
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              {SEVERITY_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-mono flex items-center space-x-1 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          {/* Bulk Action Controls */}
          {selectedIds.length > 0 && (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <span className="text-xs font-mono text-blue-400 font-semibold">
                {selectedIds.length} selected
              </span>

              <button
                type="button"
                onClick={() => setBulkModalAction("START")}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
              >
                Start Investigation
              </button>

              <button
                type="button"
                onClick={() => setBulkModalAction("IGNORE")}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs font-medium transition-colors cursor-pointer"
              >
                Bypass
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Localized Error state */}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* Priority Queue Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c121e] overflow-hidden shadow-xl" aria-busy={loading}>
        {loading && items.length === 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th scope="col" className="p-3.5 pl-4 w-10"><div className="w-4 h-4 rounded bg-slate-800/80" /></th>
                  <th scope="col" className="p-3.5">Financial Issue</th>
                  <th scope="col" className="p-3.5">Payment Reference</th>
                  <th scope="col" className="p-3.5">Financial Impact</th>
                  <th scope="col" className="p-3.5">Severity</th>
                  <th scope="col" className="p-3.5">Status</th>
                  <th scope="col" className="p-3.5">Age / Date</th>
                  <th scope="col" className="p-3.5 text-right pr-5">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 animate-pulse">
                {Array.from({ length: 10 }).map((_, i) => (
                  <tr key={`skel-act-${i}`}>
                    <td className="p-3.5 pl-4"><div className="w-4 h-4 rounded bg-slate-800/60" /></td>
                    <td className="p-3.5"><div className="h-4 w-32 rounded bg-slate-800/80" /></td>
                    <td className="p-3.5"><div className="h-4 w-24 rounded bg-slate-800/60" /></td>
                    <td className="p-3.5"><div className="h-4 w-16 rounded bg-slate-800/70" /></td>
                    <td className="p-3.5"><div className="h-5 w-18 rounded bg-slate-800/60" /></td>
                    <td className="p-3.5"><div className="h-5 w-20 rounded bg-slate-800/60" /></td>
                    <td className="p-3.5"><div className="h-4 w-18 rounded bg-slate-800/40" /></td>
                    <td className="p-3.5 text-right pr-5"><div className="h-4 w-14 rounded bg-slate-800/40 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
            <p className="text-slate-200 font-semibold text-sm font-sans">
              {isFiltered ? "No matching queue items" : `No ${statusFilter.toLowerCase()} items in queue`}
            </p>
            <p className="text-slate-400 font-mono text-xs max-w-md mx-auto">
              {isFiltered
                ? "No exceptions match the selected filter criteria."
                : statusFilter === "OPEN"
                ? "All financial discrepancies have been reviewed. No open issues currently requiring human triage."
                : `Zero exceptions currently in ${statusFilter.toLowerCase()} status.`}
            </p>
            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold cursor-pointer transition-colors"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th scope="col" className="p-3.5 pl-4 w-10">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-slate-400 hover:text-white"
                      title="Select all items on this page"
                    >
                      {selectedIds.length === items.length && items.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="p-3.5">Financial Issue</th>
                  <th scope="col" className="p-3.5">Payment Reference</th>
                  <th scope="col" className="p-3.5">Financial Impact</th>
                  <th scope="col" className="p-3.5">Severity</th>
                  <th scope="col" className="p-3.5">Status</th>
                  <th scope="col" className="p-3.5">Detected / Age</th>
                  <th scope="col" className="p-3.5 text-right pr-5">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item) => {
                  const isSelected = selectedIds.includes(item.exception_id);

                  return (
                    <tr
                      key={item.exception_id}
                      className={`hover:bg-slate-900/50 transition-colors group cursor-pointer ${
                        isSelected ? "bg-blue-950/20" : ""
                      }`}
                      onClick={() => router.push(`/exceptions/${item.exception_id}?dataset_id=${datasetId}`)}
                    >
                      <td className="p-3.5 pl-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(item.exception_id)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="p-3.5 font-sans">
                        <div className="font-semibold text-slate-100 group-hover:text-blue-300 transition-colors">
                          {EXCEPTION_TITLES[item.exception_type] || item.exception_type}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 truncate max-w-xs">
                          {item.exception_id}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-300">
                        {item.payment_id ? (
                          <Link
                            href={`/transactions/${item.payment_id}?dataset_id=${datasetId}`}
                            className="hover:text-blue-300 underline underline-offset-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.payment_id}
                          </Link>
                        ) : (
                          <span className="text-slate-600">N/A</span>
                        )}
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
                          className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900 text-blue-300 text-xs font-sans font-medium transition-colors border border-blue-800/40"
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

        {/* Server-Side Pagination Bar */}
        {total > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-mono">
            <div>
              Showing <strong className="text-slate-200">{startIdx}–{endIdx}</strong> of <strong className="text-slate-200">{formatNumber(total)}</strong> discrepancies (Page <strong className="text-slate-200">{page}</strong> of <strong className="text-slate-200">{totalPages}</strong>)
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => handlePageChange(page - 1)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-800 text-slate-200 flex items-center space-x-1 transition-colors cursor-pointer"
                aria-label="Previous page"
              >
                <span>Previous</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => handlePageChange(page + 1)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-800 text-slate-200 flex items-center space-x-1 transition-colors cursor-pointer"
                aria-label="Next page"
              >
                <span>Next</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Bulk Action Confirm Dialog */}
      <ConfirmDialog
        isOpen={bulkModalAction !== null}
        title={`Execute bulk ${bulkModalAction === "START" ? "Investigation" : "Bypass"} on ${selectedIds.length} items?`}
        description="Provide a mandatory note for the immutable audit ledger to record across all selected exceptions."
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
