"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Receipt,
  Layers,
  FileText,
  Clock,
  CheckCircle2,
  DollarSign,
  Info,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { fetchExceptionDetail, updateExceptionStatus, ExceptionItem } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/formatters";

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-800/60" },
  HIGH: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-800/60" },
  MEDIUM: { bg: "bg-blue-950/60", text: "text-blue-400", border: "border-blue-800/60" },
  LOW: { bg: "bg-slate-800", text: "text-slate-400", border: "border-slate-700" },
};

export default function ExceptionDetailPage({ params }: { params: Promise<{ exception_id: string }> }) {
  const { exception_id } = use(params);
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id") || "";

  const [exception, setException] = useState<ExceptionItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  useEffect(() => {
    if (datasetId && exception_id) {
      loadDetail();
    }
  }, [datasetId, exception_id]);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExceptionDetail(datasetId, exception_id);
      setException(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exception details.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!exception) return;
    setUpdatingStatus(true);
    try {
      await updateExceptionStatus(datasetId, exception.exception_id, newStatus);
      setException({ ...exception, status: newStatus });
    } catch (err) {
      console.error("Failed to update status", err);
    } finally {
      setUpdatingStatus(false);
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
        <div className="flex items-center justify-between">
          <Link
            href={`/exceptions?dataset_id=${datasetId}`}
            className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Exceptions Queue</span>
          </Link>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Status:</span>
            <select
              disabled={updatingStatus || !exception}
              value={exception?.status || "OPEN"}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1 font-mono focus:outline-none focus:border-blue-500"
            >
              <option value="OPEN">OPEN</option>
              <option value="INVESTIGATING">INVESTIGATING</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="IGNORED">IGNORED</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-16 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm font-semibold text-white">Loading Exception Audit Breakdown...</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Content Body */}
        {!loading && exception && (
          <div className="space-y-6">
            
            {/* Hero Summary Card */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white tracking-tight">
                      {exception.exception_type}
                    </h1>
                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 mt-0.5">
                      <span>ID: {exception.exception_id}</span>
                      <span>•</span>
                      <span>Logged: {formatDate(exception.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Potential Financial Impact</span>
                  <span className="text-2xl font-bold font-mono text-rose-400">
                    {formatCurrency(exception.amount_discrepancy)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                {exception.description}
              </div>
            </div>

            {/* Two Column Grid: Financial Calculation & Transaction Info */}
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Financial Calculation Breakdown */}
              <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
                <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <span>Deterministic Calculation Breakdown</span>
                </h2>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">Calculated Expected Net</span>
                    <span className="font-bold text-blue-400">{formatCurrency(exception.expected_settlement)}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">Actual Bank Credit</span>
                    <span className="font-bold text-slate-200">{formatCurrency(exception.actual_settlement)}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/40 flex items-center justify-between">
                    <span className="text-rose-400">Discrepancy</span>
                    <span className="font-bold text-rose-300">{formatCurrency(exception.amount_discrepancy)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  Formula: Expected = Payment - Refunds - MDR Fee - GST Tax
                </div>
              </div>

              {/* Transaction Context */}
              <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
                <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>Transaction References</span>
                </h2>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">Payment ID</span>
                    {exception.payment_id ? (
                      <Link
                        href={`/transactions/${exception.payment_id}?dataset_id=${datasetId}`}
                        className="text-blue-400 hover:underline flex items-center space-x-1"
                      >
                        <span>{exception.payment_id}</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span className="text-slate-500">N/A</span>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">Severity</span>
                    <span className="text-amber-300 font-bold">{exception.severity}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">Audit Status</span>
                    <span className="text-slate-200">{exception.status}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Lifecycle Timeline */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Transaction Lifecycle Timeline</span>
              </h2>

              <div className="space-y-4 relative pl-5 border-l-2 border-slate-800 ml-2">
                {exception.timeline?.map((step, idx) => (
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

            {/* Machine-Readable Evidence Payload */}
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Auditable Evidence Packet</span>
              </h2>
              <pre className="p-4 rounded-lg bg-slate-950 text-slate-300 text-[11px] font-mono overflow-x-auto border border-slate-800">
                {JSON.stringify(exception.evidence, null, 2)}
              </pre>
            </div>

          </div>
        )}

      </div>
    </AppShell>
  );
}
