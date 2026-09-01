"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Receipt,
  Search,
  RefreshCw,
  Database,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Filter,
  X,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { fetchTransactions, TransactionItem } from "@/lib/api";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/FeedbackStates";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { formatDate, formatNumber } from "@/lib/formatters";

const STATUS_FILTERS = [
  { value: "ALL", label: "All Statuses" },
  { value: "RECONCILED", label: "Reconciled" },
  { value: "MISSING_SETTLEMENT", label: "Missing Settlement" },
  { value: "DUPLICATE_SETTLEMENT", label: "Duplicate Settlement" },
  { value: "AMOUNT_MISMATCH", label: "Amount Mismatch" },
  { value: "REFUND_MISMATCH", label: "Refund Mismatch" },
  { value: "UNEXPECTED_FEE", label: "Fee Anomaly" },
  { value: "DELAYED_SETTLEMENT", label: "Delayed Settlement" },
  { value: "ORPHAN_SETTLEMENT", label: "Orphan Settlement" },
  { value: "FAILED", label: "Failed" },
];

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case "RECONCILED":
    case "SUCCESS":
      return "bg-emerald-950/50 text-emerald-400 border-emerald-800/50";
    case "MISSING_SETTLEMENT":
    case "AMOUNT_MISMATCH":
    case "ORPHAN_SETTLEMENT":
      return "bg-rose-950/50 text-rose-400 border-rose-800/50";
    case "DUPLICATE_SETTLEMENT":
      return "bg-purple-950/50 text-purple-400 border-purple-800/50";
    case "REFUND_MISMATCH":
    case "UNEXPECTED_FEE":
    case "FEE_ANOMALY":
      return "bg-amber-950/50 text-amber-400 border-amber-800/50";
    case "DELAYED_SETTLEMENT":
      return "bg-sky-950/50 text-sky-400 border-sky-800/50";
    default:
      return "bg-slate-900 text-slate-400 border-slate-800";
  }
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const datasetId = searchParams.get("dataset_id") || "";
  const initialStatus = searchParams.get("status") || "ALL";
  const initialSearch = searchParams.get("search") || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
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
    router.replace(`/transactions?${params.toString()}`);
  };

  useEffect(() => {
    if (datasetId) {
      loadTransactions();
    }
  }, [datasetId, statusFilter, search, page]);

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTransactions(datasetId, {
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: search.trim() || undefined,
        page: page,
        limit: limit,
      });
      setTransactions(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
    updateUrl({ status: newStatus, page: 1 });
  };

  const handleSearchChange = (q: string) => {
    setSearch(q);
    setPage(1);
    updateUrl({ search: q, page: 1 });
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    updateUrl({ page: p });
  };

  const handleResetFilters = () => {
    setStatusFilter("ALL");
    setSearch("");
    setPage(1);
    updateUrl({ status: "ALL", search: "", page: 1 });
  };

  if (!datasetId) {
    return (
      <EmptyState
        icon={Database}
        title="No Financial Dataset Selected"
        description="Select a financial session to inspect the transaction ledger."
        action={
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
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

  return (
    <div className="space-y-6">
      
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: `/dashboard?dataset_id=${datasetId}` },
          { label: "Transactions Ledger", isCurrent: true },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-sm">
              <Receipt className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Reconciled Transactions Ledger
            </h1>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              {formatNumber(total)} Records
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Complete transaction-level audit trail comparing gross captures with expected and actual bank settlements.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadTransactions}
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition-colors cursor-pointer self-start md:self-auto shadow-sm"
          aria-label="Refresh transactions ledger"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Toolbar / Search & Filter Controls */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-[#0c121e] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-md">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by Payment ID or Order ID..."
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

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              aria-label="Filter transactions by status"
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {(statusFilter !== "ALL" || search.trim() !== "") && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-mono flex items-center space-x-1 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Localized Error state */}
      {error && <ErrorState message={error} onRetry={loadTransactions} />}

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c121e] overflow-hidden shadow-xl" aria-busy={loading}>
        {loading && transactions.length === 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th scope="col" className="p-3.5 pl-5">Payment Reference</th>
                  <th scope="col" className="p-3.5">Order ID</th>
                  <th scope="col" className="p-3.5">Gross Amount</th>
                  <th scope="col" className="p-3.5">Expected Payout</th>
                  <th scope="col" className="p-3.5">Actual Settled</th>
                  <th scope="col" className="p-3.5">Discrepancy</th>
                  <th scope="col" className="p-3.5">Reconciliation Status</th>
                  <th scope="col" className="p-3.5">Audit Timestamp</th>
                  <th scope="col" className="p-3.5 text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 animate-pulse">
                {Array.from({ length: 10 }).map((_, i) => (
                  <tr key={`skel-tx-${i}`}>
                    <td className="p-3.5 pl-5"><div className="h-4 w-28 rounded bg-slate-800/80" /></td>
                    <td className="p-3.5"><div className="h-4 w-24 rounded bg-slate-800/60" /></td>
                    <td className="p-3.5"><div className="h-4 w-16 rounded bg-slate-800/70" /></td>
                    <td className="p-3.5"><div className="h-4 w-16 rounded bg-slate-800/50" /></td>
                    <td className="p-3.5"><div className="h-4 w-16 rounded bg-slate-800/50" /></td>
                    <td className="p-3.5"><div className="h-4 w-14 rounded bg-slate-800/50" /></td>
                    <td className="p-3.5"><div className="h-5 w-20 rounded bg-slate-800/60" /></td>
                    <td className="p-3.5"><div className="h-4 w-18 rounded bg-slate-800/40" /></td>
                    <td className="p-3.5 text-right pr-5"><div className="h-4 w-12 rounded bg-slate-800/40 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
            <p className="text-slate-300 font-semibold text-sm font-sans">No matching transactions found</p>
            <p className="text-slate-500 font-mono text-xs max-w-sm mx-auto">
              No transactions match the selected filter criteria in this session.
            </p>
            {(statusFilter !== "ALL" || search.trim()) && (
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
                  <th scope="col" className="p-3.5 pl-5">Payment Reference</th>
                  <th scope="col" className="p-3.5">Order ID</th>
                  <th scope="col" className="p-3.5">Gross Amount</th>
                  <th scope="col" className="p-3.5">Expected Payout</th>
                  <th scope="col" className="p-3.5">Actual Settled</th>
                  <th scope="col" className="p-3.5">Discrepancy</th>
                  <th scope="col" className="p-3.5">Reconciliation Status</th>
                  <th scope="col" className="p-3.5">Audit Timestamp</th>
                  <th scope="col" className="p-3.5 text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.map((tx) => {
                  const hasDiscrepancy = tx.difference !== 0;
                  return (
                    <tr
                      key={tx.payment_id}
                      className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/transactions/${tx.payment_id}?dataset_id=${datasetId}`)}
                    >
                      <td className="p-3.5 pl-5 font-semibold text-slate-100 group-hover:text-blue-300 transition-colors">
                        {tx.payment_id}
                      </td>
                      <td className="p-3.5 text-slate-400">{tx.order_id}</td>
                      <td className="p-3.5">
                        <FinancialAmount amount={tx.amount} size="sm" variant="neutral" />
                      </td>
                      <td className="p-3.5 text-slate-400">
                        <FinancialAmount amount={tx.expected_settlement} size="sm" variant="muted" />
                      </td>
                      <td className="p-3.5 text-slate-400">
                        <FinancialAmount amount={tx.actual_settlement} size="sm" variant="muted" />
                      </td>
                      <td className="p-3.5">
                        {hasDiscrepancy ? (
                          <FinancialAmount amount={tx.difference} size="sm" variant="danger" />
                        ) : (
                          <span className="text-slate-500 font-mono">₹0.00</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadgeStyle(
                            tx.status
                          )}`}
                        >
                          {tx.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="p-3.5 text-right pr-5">
                        <Link
                          href={`/transactions/${tx.payment_id}?dataset_id=${datasetId}`}
                          className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900 text-blue-300 text-xs font-sans font-medium transition-colors border border-blue-800/40"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>View</span>
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

        {/* Server-Side Pagination Controls */}
        {total > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-mono">
            <div>
              Showing <strong className="text-slate-200">{startIdx}–{endIdx}</strong> of <strong className="text-slate-200">{formatNumber(total)}</strong> transactions (Page <strong className="text-slate-200">{page}</strong> of <strong className="text-slate-200">{totalPages}</strong>)
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

export default function TransactionsPage() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingState message="Loading transactions ledger..." />}>
        <TransactionsContent />
      </Suspense>
    </AppShell>
  );
}
