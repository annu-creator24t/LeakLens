"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Search,
  Filter,
  Eye,
  RefreshCw,
  ArrowRight,
  Database,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchReconciliationExceptions,
  fetchExceptionSummary,
  ExceptionItem,
  ExceptionSummaryResponse
} from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";

const EXCEPTION_TYPES: Record<string, string> = {
  ALL: "All Exception Types",
  MISSING_SETTLEMENT: "Missing Settlement",
  DUPLICATE_SETTLEMENT: "Duplicate Settlement",
  AMOUNT_MISMATCH: "Amount Mismatch",
  REFUND_MISMATCH: "Refund Mismatch",
  UNEXPECTED_FEE: "Fee Anomaly",
  DELAYED_SETTLEMENT: "Delayed Settlement",
  ORPHAN_SETTLEMENT: "Orphan Settlement",
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-800/60" },
  HIGH: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-800/60" },
  MEDIUM: { bg: "bg-blue-950/60", text: "text-blue-400", border: "border-blue-800/60" },
  LOW: { bg: "bg-slate-800", text: "text-slate-400", border: "border-slate-700" },
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

  // Sync URL with state
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
      setError(err instanceof Error ? err.message : "Failed to load exceptions.");
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
      <div className="p-12 rounded-xl border border-dashed border-slate-800 bg-[#0c121e]/40 flex flex-col items-center justify-center text-center space-y-4">
        <Database className="w-12 h-12 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-200">No Dataset Selected</h2>
        <p className="text-xs text-slate-400">Select a financial session to inspect exceptions.</p>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <span>Exception Triage Queue</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              {formatNumber(total)} Exceptions
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Audit detected financial discrepancies, uncontracted fee deviations, and missing payout settlements.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadExceptions}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Payment ID, Exception ID, or reason..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Exception Type Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-blue-500"
            >
              {Object.entries(EXCEPTION_TYPES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Severity Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80 text-xs">
          <span className="text-slate-500 mr-2 flex items-center space-x-1">
            <Filter className="w-3 h-3" />
            <span>Severity:</span>
          </span>
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => {
            const isSelected = severity === sev;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => handleSeverityChange(sev)}
                className={`px-3 py-1 rounded font-mono text-[11px] border transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                    : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                {sev}
              </button>
            );
          })}
        </div>

      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Data Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0c121e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/80 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="p-3.5 pl-4">Exception</th>
                <th className="p-3.5">Payment ID</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5 text-right">Financial Impact</th>
                <th className="p-3.5 text-center">Severity</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5">Detected At</th>
                <th className="p-3.5 text-center pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
                    <span>Loading exception queue...</span>
                  </td>
                </tr>
              ) : exceptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 font-sans">
                    No exceptions found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                exceptions.map((exc) => {
                  const sevStyle = SEVERITY_COLORS[exc.severity] || SEVERITY_COLORS.MEDIUM;
                  return (
                    <tr key={exc.exception_id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3.5 pl-4 font-bold text-slate-300">
                        {exc.exception_id}
                      </td>
                      <td className="p-3.5 text-blue-400">
                        {exc.payment_id ? (
                          <Link href={`/transactions/${exc.payment_id}?dataset_id=${datasetId}`} className="hover:underline">
                            {exc.payment_id}
                          </Link>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-300 font-sans">
                        {EXCEPTION_TYPES[exc.exception_type] || exc.exception_type}
                      </td>
                      <td className="p-3.5 text-right font-bold text-rose-400">
                        {formatCurrency(exc.amount_discrepancy)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${sevStyle.bg} ${sevStyle.text} ${sevStyle.border}`}>
                          {exc.severity}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {exc.status || "OPEN"}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {formatDate(exc.created_at)}
                      </td>
                      <td className="p-3.5 text-center pr-4">
                        <Link
                          href={`/exceptions/${exc.exception_id}?dataset_id=${datasetId}`}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span>Audit</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {total > limit && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {formatNumber(total)} exceptions
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white flex items-center space-x-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="font-mono text-white px-2">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white flex items-center space-x-1"
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
      <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading Exception Triage...</div>}>
        <ExceptionsListContent />
      </Suspense>
    </AppShell>
  );
}
