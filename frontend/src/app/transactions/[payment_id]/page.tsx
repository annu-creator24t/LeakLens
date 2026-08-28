"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Receipt,
  DollarSign,
  AlertTriangle,
  Clock,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  FileSpreadsheet
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { fetchTransactionDetail, TransactionDetail } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/formatters";

export default function TransactionDetailPage({ params }: { params: Promise<{ payment_id: string }> }) {
  const { payment_id } = use(params);
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id") || "";

  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (datasetId && payment_id) {
      loadDetail();
    }
  }, [datasetId, payment_id]);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTransactionDetail(datasetId, payment_id);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction.");
    } finally {
      setLoading(false);
    }
  };

  if (!datasetId) {
    return (
      <AppShell>
        <div className="p-12 text-center text-slate-500 font-mono">
          No dataset session provided in query params.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        
        {/* Back Link */}
        <Link
          href={`/transactions?dataset_id=${datasetId}`}
          className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Transactions Ledger</span>
        </Link>

        {/* Loading */}
        {loading && (
          <div className="p-16 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm font-semibold text-white">Loading Transaction Ledger Audit...</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Content */}
        {!loading && detail && (
          <div className="space-y-6">
            
            {/* Header Card */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-950/60 border border-blue-800/60 flex items-center justify-center text-blue-400">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white tracking-tight font-mono">
                      {detail.payment.payment_id}
                    </h1>
                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 mt-0.5">
                      <span>Order: {detail.payment.order_id}</span>
                      <span>•</span>
                      <span>Created: {formatDate(detail.payment.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded border font-semibold ${
                      detail.status === "RECONCILED"
                        ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                        : "bg-rose-950/60 text-rose-400 border-rose-800/60"
                    }`}
                  >
                    {detail.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Reconciliation Math Card */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-blue-400" />
                <span>Deterministic Reconciliation Formula</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Payment Amount</span>
                  <p className="font-bold text-slate-200">{formatCurrency(detail.calculation.payment_amount)}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Refund Deductions</span>
                  <p className="font-bold text-slate-400">-{formatCurrency(detail.calculation.refund_deduction)}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Fee + Tax Deductions</span>
                  <p className="font-bold text-slate-400">-{formatCurrency(detail.calculation.fee_deduction + detail.calculation.tax_deduction)}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/40">
                  <span className="text-blue-400 text-[10px]">Expected Net Payout</span>
                  <p className="font-bold text-blue-300">{formatCurrency(detail.calculation.expected_settlement)}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Actual Bank Credit Recorded:</span>
                <span className="font-bold text-slate-200">{formatCurrency(detail.calculation.actual_settlement)}</span>
              </div>
            </div>

            {/* Settlements & Refunds Lists */}
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Settlements */}
              <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                  Settlement Records ({detail.settlements.length})
                </h3>
                {detail.settlements.length === 0 ? (
                  <p className="text-xs text-rose-400 font-mono">No settlement record credited for this payment.</p>
                ) : (
                  detail.settlements.map((s, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs font-mono flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-200">{s.settlement_id}</p>
                        <p className="text-[10px] text-slate-500">{formatDate(s.settlement_date)}</p>
                      </div>
                      <span className="font-bold text-blue-400">{formatCurrency(s.settlement_amount)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Refunds */}
              <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                  Refund Records ({detail.refunds.length})
                </h3>
                {detail.refunds.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono">No customer refund requested.</p>
                ) : (
                  detail.refunds.map((r, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs font-mono flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-200">{r.refund_id}</p>
                        <p className="text-[10px] text-slate-500">{formatDate(r.refund_date)}</p>
                      </div>
                      <span className="font-bold text-amber-400">{formatCurrency(r.refund_amount)}</span>
                    </div>
                  ))
                )}
              </div>

            </div>

            {/* Chronological Timeline */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Transaction Timeline</span>
              </h2>

              <div className="space-y-4 relative pl-5 border-l-2 border-slate-800 ml-2">
                {detail.timeline?.map((step, idx) => (
                  <div key={idx} className="relative space-y-0.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -left-[27px] top-1 border-2 border-[#0c121e]" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{step.event}</span>
                      <span className="text-[10px] font-mono text-slate-500">{formatDate(step.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">{step.details}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </AppShell>
  );
}
