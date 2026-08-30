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
  ArrowRight
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { fetchTransactions, TransactionItem } from "@/lib/api";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { StatusBadge } from "@/components/ui/Badges";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/FeedbackStates";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { formatDate, formatNumber } from "@/lib/formatters";

const STATUS_FILTERS = [
  "ALL",
  "RECONCILED",
  "MISSING_SETTLEMENT",
  "DUPLICATE_SETTLEMENT",
  "AMOUNT_MISMATCH",
  "REFUND_MISMATCH",
  "UNEXPECTED_FEE",
  "DELAYED_SETTLEMENT",
  "MISMATCH",
  "FAILED",
];

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

  if (!datasetId) {
    return (
      <EmptyState
        icon={Database}
        title="No Financial Dataset Selected"
        description="Select a financial session to inspect the transaction ledger."
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
          { label: "Transactions", isCurrent: true },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
            <span>Reconciled Transactions Ledger</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              {formatNumber(total)} Records
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Complete transaction-level audit trail with expected vs actual bank settlement credits.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadTransactions}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition-colors cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by Payment ID or Order ID..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors font-mono"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            aria-label="Filter by Transaction Status"
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono outline-none focus:border-blue-500"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={loadTransactions} />}

      {/* Table Container */}
      <div className="rounded-xl border border-slate-800 bg-[#0c121e] overflow-hidden shadow-lg" aria-busy={loading}>
        {loading && transactions.length === 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 pl-5">Payment ID</th>
                  <th className="p-3.5">Order ID</th>
                  <th className="p-3.5">Gross Amount</th>
                  <th className="p-3.5">Expected Payout</th>
                  <th className="p-3.5">Actual Settled</th>
                  <th className="p-3.5">Difference</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right pr-5">Detail</th>
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
                    <td className="p-3.5 text-right pr-5"><div className="h-4 w-6 rounded bg-slate-800/40 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-slate-400 font-mono text-xs">No transactions match the selected filter criteria.</p>
            {(statusFilter !== "ALL" || search.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setSearch("");
                  setPage(1);
                  updateUrl({ status: "ALL", search: "", page: 1 });
                }}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold cursor-pointer transition-colors"
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
                  <th className="p-3.5 pl-5">Payment ID</th>
                  <th className="p-3.5">Order ID</th>
                  <th className="p-3.5">Gross Amount</th>
                  <th className="p-3.5">Expected Payout</th>
                  <th className="p-3.5">Actual Settled</th>
                  <th className="p-3.5">Difference</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right pr-5">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.map((tx) => (
                  <tr
                    key={tx.payment_id}
                    className="hover:bg-slate-900/40 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/transactions/${tx.payment_id}?dataset_id=${datasetId}`)}
                  >
                    <td className="p-3.5 pl-5 font-semibold text-slate-100">
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
                      {tx.difference !== 0 ? (
                        <FinancialAmount amount={tx.difference} size="sm" variant="danger" />
                      ) : (
                        <span className="text-slate-500 font-mono">₹0.00</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          tx.status === "RECONCILED"
                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/50"
                            : "bg-rose-950/40 text-rose-400 border-rose-800/50"
                        }`}
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
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-950/60 hover:bg-blue-900 text-blue-300 text-xs font-sans font-medium transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>View</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div>
              Page <strong className="text-slate-200">{page}</strong> of <strong className="text-slate-200">{totalPages}</strong>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => handlePageChange(page - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => handlePageChange(page + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 transition-colors"
              >
                Next
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
