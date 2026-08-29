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
  Sliders,
  ChevronLeft,
  ChevronRight
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

  if (!datasetId) {
    return (
      <EmptyState
        icon={Database}
        title="No Financial Dataset Selected"
        description="Select a financial session from the header or return to the overview dashboard."
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
          { label: "Financial Discrepancies", isCurrent: true },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <span>Financial Discrepancy Queue</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              {formatNumber(total)} Issues
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Complete inventory of deterministic reconciliation exceptions detected across this dataset.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadExceptions}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition-colors cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by Payment ID or Exception ID..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors font-mono"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Severity Dropdown */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span>Severity:</span>
            <select
              value={severity}
              onChange={(e) => handleSeverityChange(e.target.value)}
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

          {/* Issue Type Dropdown */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              aria-label="Filter by Issue Type"
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono outline-none focus:border-blue-500 max-w-xs"
            >
              {Object.entries(EXCEPTION_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={loadExceptions} />}

      {/* Table Container */}
      <div className="rounded-xl border border-slate-800 bg-[#0c121e] overflow-hidden shadow-lg">
        {loading ? (
          <LoadingState
            message="Loading financial discrepancy queue..."
            subMessage="Filtering ledger records"
            size="md"
          />
        ) : exceptions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            No financial discrepancies match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 pl-5">Financial Issue</th>
                  <th className="p-3.5">Payment ID</th>
                  <th className="p-3.5">Discrepancy</th>
                  <th className="p-3.5">Expected</th>
                  <th className="p-3.5">Actual</th>
                  <th className="p-3.5">Severity</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Detected</th>
                  <th className="p-3.5 text-right pr-5">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {exceptions.map((item) => (
                  <tr
                    key={item.exception_id}
                    className="hover:bg-slate-900/40 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/exceptions/${item.exception_id}?dataset_id=${datasetId}`)}
                  >
                    <td className="p-3.5 pl-5 font-sans">
                      <div className="font-semibold text-slate-100">
                        {EXCEPTION_TYPES[item.exception_type] || item.exception_type}
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
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-950/60 hover:bg-blue-900 text-blue-300 text-xs font-sans font-medium transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
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
                onClick={() => handlePageChange(page - 1)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => handlePageChange(page + 1)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
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
      <Suspense fallback={<LoadingState message="Loading exceptions..." />}>
        <ExceptionsListContent />
      </Suspense>
    </AppShell>
  );
}
