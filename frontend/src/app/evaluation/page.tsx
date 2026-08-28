"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Activity,
  ArrowLeft,
  RefreshCw,
  Award,
  BarChart3,
  Target,
  CheckCircle,
  AlertCircle,
  Database,
  Cpu,
} from "lucide-react";
import { runEvaluation, generateSyntheticDataset, EvaluationResponse } from "@/lib/api";

const TYPE_NAMES: Record<string, string> = {
  MISSING_SETTLEMENT: "Missing Settlement",
  DUPLICATE_SETTLEMENT: "Duplicate Settlement",
  AMOUNT_MISMATCH: "Amount Mismatch",
  REFUND_MISMATCH: "Refund Mismatch",
  FEE_ANOMALY: "Fee Anomaly",
  DELAYED_SETTLEMENT: "Delayed Settlement",
  ORPHAN_SETTLEMENT: "Orphan Settlement",
};

function EvaluationView() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("dataset_id") || "";

  const [datasetId, setDatasetId] = useState<string>(initialId);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialId) {
      handleEvaluate(initialId);
    }
  }, [initialId]);

  const handleEvaluate = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runEvaluation(id.trim());
      setEvaluation(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run ground truth evaluation.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunPreset = async (count: number) => {
    setLoading(true);
    setError(null);
    try {
      const genRes = await generateSyntheticDataset({
        transaction_count: count,
        anomaly_rate: 0.05,
        seed: 12345,
        merchant_id: "M001",
        anomalies: {
          missing_settlement: true,
          duplicate_settlement: true,
          amount_mismatch: true,
          refund_mismatch: true,
          fee_anomaly: true,
          delayed_settlement: true,
          orphan_settlement: true,
        },
      });
      setDatasetId(genRes.dataset_id);
      const evalRes = await runEvaluation(genRes.dataset_id);
      setEvaluation(evalRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Benchmark execution failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
              <span>Ground Truth Benchmark Evaluator</span>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
              Developer Only
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Audits deterministic exception detection against controlled synthetic ground-truth labels.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleRunPreset(1000)}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>1k Preset Benchmark</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleRunPreset(10000)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center space-x-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)] cursor-pointer"
          >
            <Award className="w-3.5 h-3.5" />
            <span>10k Official Benchmark</span>
          </button>
        </div>
      </div>

      {/* Dataset Input & Trigger Bar */}
      <div className="p-4 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Database className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Enter synthetic dataset ID (e.g. gen_4a2a27c1a4)..."
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          type="button"
          disabled={loading || !datasetId.trim()}
          onClick={() => handleEvaluate(datasetId)}
          className="w-full sm:w-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center space-x-2 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Evaluate Dataset</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="p-12 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col items-center justify-center text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-semibold text-white">Running Ground Truth Benchmark Evaluator...</p>
          <p className="text-xs text-slate-500 font-mono">Computing confusion matrix (TP, FP, FN) and F1 metrics</p>
        </div>
      )}

      {/* Evaluation Results */}
      {!loading && evaluation && (
        <div className="space-y-6">
          
          {/* Top Metric Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 flex flex-col justify-between space-y-2">
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1.5">
                <Target className="w-4 h-4" />
                <span>Overall F1 Score</span>
              </span>
              <div className="text-3xl font-bold font-mono text-white">
                {(evaluation.overall.f1 * 100).toFixed(2)}%
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Macro F1: {(evaluation.overall.macro_f1 * 100).toFixed(2)}%
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col justify-between space-y-2">
              <span className="text-xs text-slate-400 font-medium">Precision (TP / TP+FP)</span>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {(evaluation.overall.precision * 100).toFixed(2)}%
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {evaluation.overall.total_tp} TP / {evaluation.overall.total_fp} FP
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col justify-between space-y-2">
              <span className="text-xs text-slate-400 font-medium">Recall (TP / TP+FN)</span>
              <div className="text-2xl font-bold font-mono text-blue-400">
                {(evaluation.overall.recall * 100).toFixed(2)}%
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {evaluation.overall.total_tp} TP / {evaluation.overall.total_fn} FN
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col justify-between space-y-2">
              <span className="text-xs text-slate-400 font-medium">Evaluation Latency</span>
              <div className="text-2xl font-bold font-mono text-slate-200">
                {evaluation.evaluation_time_ms} ms
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Ground Truth: {evaluation.total_ground_truth} | Detected: {evaluation.total_detected}
              </p>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="rounded-xl border border-slate-800 bg-[#0c121e] p-6 space-y-4">
            <h2 className="text-base font-semibold text-white tracking-tight flex items-center space-x-2">
              <span>Per-Anomaly Performance Breakdown</span>
              <BarChart3 className="w-4 h-4 text-emerald-400" />
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-800/80">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/90 text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-3 pl-4">Exception Class</th>
                    <th className="p-3 text-center">TP</th>
                    <th className="p-3 text-center">FP</th>
                    <th className="p-3 text-center">FN</th>
                    <th className="p-3 text-right">Precision</th>
                    <th className="p-3 text-right">Recall</th>
                    <th className="p-3 text-right pr-4">F1 Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {Object.entries(evaluation.by_type).map(([typeKey, metrics]) => (
                    <tr key={typeKey} className="hover:bg-slate-900/40">
                      <td className="p-3 pl-4 font-semibold text-slate-200">
                        {TYPE_NAMES[typeKey] || typeKey}
                      </td>
                      <td className="p-3 text-center text-emerald-400 font-bold">{metrics.tp}</td>
                      <td className="p-3 text-center text-slate-400">{metrics.fp}</td>
                      <td className="p-3 text-center text-slate-400">{metrics.fn}</td>
                      <td className="p-3 text-right text-slate-300">{(metrics.precision * 100).toFixed(1)}%</td>
                      <td className="p-3 text-right text-slate-300">{(metrics.recall * 100).toFixed(1)}%</td>
                      <td className="p-3 text-right pr-4 font-bold text-emerald-400">
                        {(metrics.f1 * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

export default function EvaluationPage() {
  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col justify-between fintech-grid">
      <header className="border-b border-slate-800/80 bg-[#080b11]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/reconciliation"
              className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Reconciliation</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-white tracking-tight">LEAKLENS</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-300 text-sm font-medium">Evaluation Benchmark</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/generator"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors border border-blue-900/50 px-3 py-1.5 rounded-lg bg-blue-950/40"
            >
              Generator
            </Link>
            <Link
              href="/reconciliation"
              className="text-xs text-slate-400 hover:text-white border border-slate-800 bg-slate-900 px-3 py-1.5 rounded-lg transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading Benchmark Evaluator...</div>}>
        <EvaluationView />
      </Suspense>

      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© 2026 LeakLens. Razorpay AI Buildathon — Track 04. Phase 5 Deterministic Evaluation.</p>
      </footer>
    </div>
  );
}
