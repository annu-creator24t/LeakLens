"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Receipt,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCircle2
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { fetchTransactionDetail, TransactionDetail } from "@/lib/api";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingState, ErrorState } from "@/components/ui/FeedbackStates";
import { formatDate } from "@/lib/formatters";

function TransactionDetailContent({ paymentId }: { paymentId: string }) {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id") || "";

  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (datasetId && paymentId) {
      loadDetail();
    }
  }, [datasetId, paymentId]);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTransactionDetail(datasetId, paymentId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction.");
    } finally {
      setLoading(false);
    }
  };

  if (!datasetId) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono text-xs">
        No dataset session provided in query params.
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <LoadingState
        message="Loading transaction detail..."
        subMessage="Extracting payment, fee, and settlement records"
        size="lg"
      />
    );
  }

  if (!detail) {
    return (
      <ErrorState
        message={error || "Transaction record not found."}
        onRetry={loadDetail}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      
      {/* Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: "Overview", href: `/dashboard?dataset_id=${datasetId}` },
            { label: "Transactions", href: `/transactions?dataset_id=${datasetId}` },
            { label: paymentId, isCurrent: true },
          ]}
        />

        <Link
          href={`/transactions?dataset_id=${datasetId}`}
          className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Transactions Ledger</span>
        </Link>
      </div>

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
              className={`text-xs px-2.5 py-1 rounded-md border font-semibold font-mono ${
                detail.status === "RECONCILED"
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/50"
                  : "bg-rose-950/40 text-rose-400 border-rose-800/50"
              }`}
            >
              {detail.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Reconciliation Math Card */}
      <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
        <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
          Deterministic Reconciliation Math
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 space-y-1">
            <span className="text-slate-500 text-[10px] uppercase block">Gross Amount</span>
            <FinancialAmount amount={detail.calculation.payment_amount} size="base" variant="neutral" />
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 space-y-1">
            <span className="text-slate-500 text-[10px] uppercase block">Refund Deduction</span>
            <FinancialAmount amount={detail.calculation.refund_deduction} size="base" variant="muted" />
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 space-y-1">
            <span className="text-slate-500 text-[10px] uppercase block">Fee & Taxes</span>
            <FinancialAmount
              amount={detail.calculation.fee_deduction + detail.calculation.tax_deduction}
              size="base"
              variant="muted"
            />
          </div>

          <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/40 space-y-1">
            <span className="text-blue-400 text-[10px] uppercase block">Expected Net</span>
            <FinancialAmount amount={detail.calculation.expected_settlement} size="base" variant="neutral" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Actual Bank Credit Recorded:</span>
          <FinancialAmount amount={detail.calculation.actual_settlement} size="base" variant="neutral" />
        </div>
      </div>

      {/* Settlements & Refunds Lists */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Settlements */}
        <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            Settlement Records ({detail.settlements.length})
          </h3>
          {detail.settlements.length === 0 ? (
            <p className="text-xs text-rose-400 font-mono p-3 rounded bg-rose-950/20 border border-rose-900/30">
              No settlement record credited for this payment.
            </p>
          ) : (
            detail.settlements.map((s, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 text-xs font-mono flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-200">{s.settlement_id}</p>
                  <p className="text-[10px] text-slate-500">{formatDate(s.settlement_date)}</p>
                </div>
                <FinancialAmount amount={s.settlement_amount} size="sm" variant="neutral" />
              </div>
            ))
          )}
        </div>

        {/* Refunds */}
        <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            Refund Records ({detail.refunds.length})
          </h3>
          {detail.refunds.length === 0 ? (
            <p className="text-xs text-slate-500 font-mono p-3 rounded bg-slate-950/40">
              No customer refund requested.
            </p>
          ) : (
            detail.refunds.map((r, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 text-xs font-mono flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-200">{r.refund_id}</p>
                  <p className="text-[10px] text-slate-500">{formatDate(r.refund_date)}</p>
                </div>
                <FinancialAmount amount={r.refund_amount} size="sm" variant="muted" />
              </div>
            ))
          )}
        </div>

      </div>

      {/* Chronological Timeline */}
      <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
        <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span>Transaction Audit Timeline</span>
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
  );
}

export default function TransactionDetailPage({ params }: { params: Promise<{ payment_id: string }> }) {
  const { payment_id } = use(params);

  return (
    <AppShell>
      <Suspense fallback={<LoadingState message="Loading transaction detail..." />}>
        <TransactionDetailContent paymentId={payment_id} />
      </Suspense>
    </AppShell>
  );
}
