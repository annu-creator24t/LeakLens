"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  Database,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchReconciliationExceptions,
  ExceptionItem
} from "@/lib/api";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { SeverityBadge, StatusBadge } from "@/components/ui/Badges";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/FeedbackStates";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextStepGuidance } from "@/components/ui/NextStepGuidance";
import { formatDate, formatNumber } from "@/lib/formatters";

const EXCEPTION_TYPES: Record<string, string> = {
  ALL: "All Issue Types",
  MISSING_SETTLEMENT: "Missing Settlement",
  DUPLICATE_SETTLEMENT: "Duplicate Settlement",
  AMOUNT_MISMATCH: "Amount Mismatch",
  REFUND_MISMATCH: "Refund Mismatch",
  UNEXPECTED_FEE: "Fee Anomaly (Excess MDR)",
  DELAYED_SETTLEMENT: "Delayed Settlement (SLA Breach)",
  ORPHAN_SETTLEMENT: "Orphan Settlement",
};

const SEVERITY_OPTIONS = [
  { value: "ALL", label: "All Severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

function ExceptionsListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const datasetId = searchParams.get("dataset_id") || "";
  const initialSeverity = searchParams.get("severity") || "ALL";
  const initialType = searchParams.get("type") || "ALL";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialSearch = searchParams.get("search") || "";

  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [severity, setSeverity] = useState<string>(initialSeverity);
  const [typeFilter, setTypeFilter] = useState<string>(initialType);
  const [search, setSearch] = useState<string>(initialSearch);
  const [page, setPage] = useState<number>(initialPage);
  const limit = 25;

  const updateUrl = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === "ALL" || v === "" || (k === "page" && v === 1)) {
        params.delete(k);
      } else {
        params.set(k, String(v));
      }
    });
    router.replace(`/exceptions?${params.toString()}`);
  };

  useEffect(() => {
    if (datasetId) {
      loadExceptions();
    }
  }, [datasetId, severity, typeFilter, search, page]);

  const loadExceptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchReconciliationExceptions(datasetId, {
        severity: severity !== "ALL" ? severity : undefined,
        exception_type: typeFilter !== "ALL" ? typeFilter : undefined,
        search: search.trim() || undefined,
        page: page,
        limit: limit,
      });
      setExceptions(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while loading exceptions.");
    } finally {
      setLoading(false);
    }
  };

  const handleSeverityChange = (newSev: string) => {
    setSeverity(newSev);
    setPage(1);
    updateUrl({ severity: newSev, page: 1 });
  };

  const handleTypeChange = (newType: string) => {
    setTypeFilter(newType);
    setPage(1);
    updateUrl({ type: newType, page: 1 });
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
    setSeverity("ALL");
    setTypeFilter("ALL");
    setSearch("");
    setPage(1);
    updateUrl({ severity: "ALL", type: "ALL", search: "", page: 1 });
  };

  if (!datasetId) {
    return (
      <EmptyState
        icon={Database}
        title="No Financial Dataset Selected"
        description="Select a financial session from the header or return to the overview dashboard."
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
  const isFiltered = severity !== "ALL" || typeFilter !== "ALL" || search.trim() !== "";

  return (
    <div className="space-y-6">
      
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: `/dashboard?dataset_id=${datasetId}` },
          { label: "Financial Discrepancy Queue", isCurrent: true },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Financial Discrepancy Queue
            </h1>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              {formatNumber(total)} Discrepancies
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Prioritized inventory of deterministic reconciliation exceptions detected across payment captures and settlement batches.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadExceptions}
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition-colors cursor-pointer self-start md:self-auto shadow-sm"
          aria-label="Refresh exceptions queue"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Contextual Next Step Guidance */}
      <NextStepGuidance
        storageKey="exceptions_queue"
        title="Guidance"
        guidance="Review discrepancies prioritized by financial impact and severity. Click any item to inspect deterministic evidence and root causes."
      />

      {/* Filter Toolbar */}
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

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Severity Dropdown */}
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Severity:</span>
            <select
              value={severity}
              onChange={(e) => handleSeverityChange(e.target.value)}
              aria-label="Filter by Severity"
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Issue Type Dropdown */}
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              aria-label="Filter by Issue Type"
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono outline-none focus:border-blue-500 max-w-xs transition-colors cursor-pointer"
            >
              {Object.entries(EXCEPTION_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
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

        </div>

      </div>

      {/* Localized Error state */}
      {error && <ErrorState message={error} onRetry={loadExceptions} />}

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c121e] overflow-hidden shadow-xl" aria-busy={loading}>
        {loading && exceptions.length === 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th scope="col" className="p-3.5 pl-5">Financial Discrepancy</th>
                  <th scope="col" className="p-3.5">Payment Reference</th>
                  <th scope="col" className="p-3.5">Financial Impact</th>
                  <th scope="col" className="p-3.5">Expected</th>
                  <th scope="col" className="p-3.5">Actual</th>
                  <th scope="col" className="p-3.5">Severity</th>
                  <th scope="col" className="p-3.5">Status</th>
                  <th scope="col" className="p-3.5">Detected</th>
                  <th scope="col" className="p-3.5 text-right pr-5">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 animate-pulse">
                {Array.from({ length: 10 }).map((_, i) => (
                  <tr key={`skel-exc-${i}`}>
                    <td className="p-3.5 pl-5"><div className="h-4 w-32 rounded bg-slate-800/80" /></td>
                    <td className="p-3.5"><div className="h-4 w-24 rounded bg-slate-800/60" /></td>
                    <td className="p-3.5"><div className="h-4 w-16 rounded bg-slate-800/70" /></td>
                    <td className="p-3.5"><div className="h-4 w-16 rounded bg-slate-800/50" /></td>
                    <td className="p-3.5"><div className="h-4 w-16 rounded bg-slate-800/50" /></td>
                    <td className="p-3.5"><div className="h-5 w-18 rounded bg-slate-800/60" /></td>
                    <td className="p-3.5"><div className="h-5 w-20 rounded bg-slate-800/60" /></td>
                    <td className="p-3.5"><div className="h-4 w-18 rounded bg-slate-800/40" /></td>
                    <td className="p-3.5 text-right pr-5"><div className="h-4 w-14 rounded bg-slate-800/40 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : exceptions.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-slate-200 font-semibold text-sm font-sans">
                {isFiltered ? "No matching financial discrepancies" : "Zero Exceptions Detected"}
              </p>
              <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                {isFiltered
                  ? "No exceptions match the selected filter criteria in this session."
                  : "All transaction captures have reconciled successfully against settlement batches. There are no outstanding revenue leakages."}
              </p>
            </div>
            {isFiltered ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold cursor-pointer transition-colors"
              >
                Reset All Filters
              </button>
            ) : (
              <Link
                href={`/transactions?dataset_id=${datasetId}`}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <span>View Reconciled Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th scope="col" className="p-3.5 pl-5">Financial Discrepancy</th>
                  <th scope="col" className="p-3.5">Payment Reference</th>
                  <th scope="col" className="p-3.5">Financial Impact</th>
                  <th scope="col" className="p-3.5">Expected</th>
                  <th scope="col" className="p-3.5">Actual</th>
                  <th scope="col" className="p-3.5">Severity</th>
                  <th scope="col" className="p-3.5">Status</th>
                  <th scope="col" className="p-3.5">Detected</th>
                  <th scope="col" className="p-3.5 text-right pr-5">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {exceptions.map((item) => (
                  <tr
                    key={item.exception_id}
                    className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/exceptions/${item.exception_id}?dataset_id=${datasetId}`)}
                  >
                    <td className="p-3.5 pl-5 font-sans">
                      <div className="font-semibold text-slate-100 group-hover:text-blue-300 transition-colors">
                        {EXCEPTION_TYPES[item.exception_type] || item.exception_type}
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

                    <td className="p-3.5 text-slate-400">
                      <FinancialAmount
                        amount={item.expected_settlement}
                        size="sm"
                        variant="muted"
                      />
                    </td>

                    <td className="p-3.5 text-slate-400">
                      <FinancialAmount
                        amount={item.actual_settlement}
                        size="sm"
                        variant="muted"
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
                        <span>Investigate</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
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
                <ChevronLeft className="w-3.5 h-3.5" />
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
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

export default function ExceptionsPage() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingState message="Loading financial exceptions..." />}>
        <ExceptionsListContent />
      </Suspense>
    </AppShell>
  );
}
