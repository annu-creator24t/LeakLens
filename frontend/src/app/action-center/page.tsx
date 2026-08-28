"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  ArrowRight,
  Database,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  XCircle,
  Play,
  FileText
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchActionCenterSummary,
  fetchPriorityQueue,
  executeBulkAction,
  ActionCenterSummary,
  ExceptionItem
} from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-800/60" },
  HIGH: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-800/60" },
  MEDIUM: { bg: "bg-blue-950/60", text: "text-blue-400", border: "border-blue-800/60" },
  LOW: { bg: "bg-slate-800", text: "text-slate-400", border: "border-slate-700" },
};

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
  const [bulkNote, setBulkNote] = useState<string>("");

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
      setError(err instanceof Error ? err.message : "Failed to load Action Center data.");
    } finally {
      setLoading(false);
    }
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

  const handleConfirmBulkAction = async () => {
    if (!bulkModalAction || selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      await executeBulkAction(datasetId, selectedIds, bulkModalAction, bulkNote);
      setBulkModalAction(null);
      setSelectedIds([]);
      setBulkNote("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setBulkLoading(false);
    }
  };

  if (!datasetId) {
    return (
      <div className="p-12 rounded-xl border border-dashed border-slate-800 bg-[#0c121e]/40 flex flex-col items-center justify-center text-center space-y-4">
        <Database className="w-12 h-12 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-200">No Dataset Selected</h2>
        <p className="text-xs text-slate-400">Select a financial session to view the Action Center.</p>
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
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span>Investigation Action Center</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Review, prioritize, and manage merchant reconciliation exceptions that require your investigation.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadData}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          <button
            type="button"
            onClick={() => { setStatusFilter("OPEN"); setPage(1); }}
            className={`p-4 rounded-xl border transition-all text-left cursor-pointer ${
              statusFilter === "OPEN"
                ? "bg-rose-950/40 border-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.2)]"
                : "bg-[#0c121e] border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Open Issues</span>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
              {formatNumber(summary.open)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Requires investigation</span>
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter("INVESTIGATING"); setPage(1); }}
            className={`p-4 rounded-xl border transition-all text-left cursor-pointer ${
              statusFilter === "INVESTIGATING"
                ? "bg-amber-950/40 border-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.2)]"
                : "bg-[#0c121e] border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Investigating</span>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {formatNumber(summary.investigating)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Active merchant reviews</span>
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter("RESOLVED"); setPage(1); }}
            className={`p-4 rounded-xl border transition-all text-left cursor-pointer ${
              statusFilter === "RESOLVED"
                ? "bg-emerald-950/40 border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "bg-[#0c121e] border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Resolved</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {formatNumber(summary.resolved)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Audit confirmed</span>
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter("IGNORED"); setPage(1); }}
            className={`p-4 rounded-xl border transition-all text-left cursor-pointer ${
              statusFilter === "IGNORED"
                ? "bg-slate-900 border-slate-600"
                : "bg-[#0c121e] border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Ignored</span>
            <div className="text-2xl font-bold font-mono text-slate-400 mt-1">
              {formatNumber(summary.ignored)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Below threshold</span>
          </button>

        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Payment ID, Order ID, or description..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto">
            {["OPEN", "INVESTIGATING", "RESOLVED", "IGNORED", "ALL"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => { setStatusFilter(st); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                  statusFilter === st
                    ? "bg-blue-600 text-white font-semibold shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                    : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

        </div>

        {/* Severity Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 mr-1 flex items-center space-x-1">
              <Filter className="w-3 h-3" />
              <span>Severity:</span>
            </span>
            {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => { setSeverityFilter(sev); setPage(1); }}
                className={`px-2.5 py-0.5 rounded font-mono text-[11px] border transition-colors cursor-pointer ${
                  severityFilter === sev
                    ? "bg-blue-600/30 text-blue-300 border-blue-500"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Bulk Action Controls */}
          {selectedIds.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono text-blue-400 font-semibold">
                {selectedIds.length} Selected
              </span>
              <button
                type="button"
                onClick={() => setBulkModalAction("START")}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-medium flex items-center space-x-1 cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <span>Mark Investigating</span>
              </button>
              <button
                type="button"
                onClick={() => setBulkModalAction("IGNORE")}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center space-x-1 cursor-pointer"
              >
                <XCircle className="w-3 h-3" />
                <span>Ignore</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Priority Action Queue Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-slate-400 hover:text-white flex items-center space-x-1.5 text-xs font-mono"
            >
              {selectedIds.length === items.length && items.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-blue-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
              <span>Select Page ({items.length})</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Deterministic Sort: Severity Priority → Impact Magnitude → Age
          </span>
        </div>

        {loading ? (
          <div className="p-16 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            <p className="text-xs font-mono text-slate-400">Loading priority action queue...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 rounded-xl border border-slate-800 bg-[#0c121e] text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-semibold text-white">No exceptions in this queue</h3>
            <p className="text-xs text-slate-400">
              All exceptions matching your filter criteria are clear.
            </p>
          </div>
        ) : (
          items.map((it) => {
            const sevStyle = SEVERITY_COLORS[it.severity] || SEVERITY_COLORS.MEDIUM;
            const isSelected = selectedIds.includes(it.exception_id);

            return (
              <div
                key={it.exception_id}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isSelected
                    ? "bg-blue-950/30 border-blue-600"
                    : "bg-[#0c121e] border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Left: Checkbox + Information */}
                <div className="flex items-start space-x-3.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleSelect(it.exception_id)}
                    className="mt-1 text-slate-500 hover:text-white"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${sevStyle.bg} ${sevStyle.text} ${sevStyle.border}`}>
                        {it.severity}
                      </span>
                      <h3 className="text-xs font-bold text-white tracking-tight">
                        {it.exception_type}
                      </h3>
                      <span className="text-slate-500 font-mono text-[11px]">•</span>
                      <span className="text-blue-400 font-mono text-xs font-semibold">
                        {it.payment_id || it.exception_id}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-1">
                      {it.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-500 pt-0.5">
                      <span>ID: {it.exception_id}</span>
                      <span>•</span>
                      <span>Detected: {formatDate(it.created_at)}</span>
                      <span>•</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                        {it.status || "OPEN"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Discrepancy Amount & Action Trigger */}
                <div className="flex items-center justify-between md:justify-end space-x-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Financial Impact</span>
                    <span className="text-base font-bold font-mono text-rose-400">
                      {formatCurrency(it.amount_discrepancy)}
                    </span>
                  </div>

                  <Link
                    href={`/exceptions/${it.exception_id}?dataset_id=${datasetId}`}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-md"
                  >
                    <span>Investigate</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

              </div>
            );
          })
        )}

        {/* Pagination Footer */}
        {total > limit && (
          <div className="p-4 rounded-xl border border-slate-800 bg-[#0c121e] flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {formatNumber(total)} prioritized issues
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
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
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white flex items-center space-x-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Bulk Action Confirmation Modal */}
      {bulkModalAction && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c121e] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white tracking-tight">
              {bulkModalAction === "START" ? "Start Bulk Investigation" : "Ignore Selected Exceptions"}
            </h3>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to mark <strong>{selectedIds.length}</strong> selected exceptions as{" "}
              <strong>{bulkModalAction === "START" ? "INVESTIGATING" : "IGNORED"}</strong>?
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400">Optional Audit Note:</label>
              <textarea
                rows={2}
                placeholder="Enter context for this bulk action..."
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={bulkLoading}
                onClick={() => setBulkModalAction(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkLoading}
                onClick={handleConfirmBulkAction}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5"
              >
                {bulkLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm {selectedIds.length} Items</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ActionCenterPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading Action Center...</div>}>
        <ActionCenterContent />
      </Suspense>
    </AppShell>
  );
}
