"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Receipt,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Database,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { fetchTransactions, TransactionItem } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";

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
  "FAILED"
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
      <div className="p-12 rounded-xl border border-dashed border-slate-800 bg-[#0c121e]/40 flex flex-col items-center justify-center text-center space-y-4">
        <Database className="w-12 h-12 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-200">No Dataset Selected</h2>
        <p className="text-xs text-slate-400">Select a financial session to inspect the transaction ledger.</p>
        <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium">
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
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Controls */}
      <div className="p-4 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Payment ID, Order ID, or status..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-blue-500"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Transactions Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0c121e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/80 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="p-3.5 pl-4">Payment ID</th>
                <th className="p-3.5">Order ID</th>
                <th className="p-3.5 text-right">Gross Amount</th>
                <th className="p-3.5 text-right">Refund</th>
                <th className="p-3.5 text-right">Fee</th>
                <th className="p-3.5 text-right">Expected Net</th>
                <th className="p-3.5 text-right">Actual Settled</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
                    <span>Loading transactions...</span>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500 font-sans">
                    No transactions found matching criteria.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isClean = tx.status === "RECONCILED";
                  return (
                    <tr key={tx.payment_id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3.5 pl-4 font-bold text-blue-400">
                        <Link href={`/transactions/${tx.payment_id}?dataset_id=${datasetId}`} className="hover:underline">
                          {tx.payment_id}
                        </Link>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {tx.order_id}
                      </td>
                      <td className="p-3.5 text-right text-slate-200">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="p-3.5 text-right text-slate-400">
                        {tx.refund_amount > 0 ? formatCurrency(tx.refund_amount) : "—"}
                      </td>
                      <td className="p-3.5 text-right text-slate-400">
                        {formatCurrency(tx.fee_amount)}
                      </td>
                      <td className="p-3.5 text-right font-medium text-blue-400">
                        {formatCurrency(tx.expected_settlement)}
                      </td>
                      <td className="p-3.5 text-right text-slate-300">
                        {formatCurrency(tx.actual_settlement)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
                            isClean
                              ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                              : "bg-rose-950/60 text-rose-400 border-rose-800/60"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center pr-4">
                        <Link
                          href={`/transactions/${tx.payment_id}?dataset_id=${datasetId}`}
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
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {formatNumber(total)} records
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

export default function TransactionsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading Transactions Ledger...</div>}>
        <TransactionsContent />
      </Suspense>
    </AppShell>
  );
}
