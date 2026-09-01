"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Download,
  CheckCircle2,
  Cpu,
  ArrowLeft,
  RefreshCw,
  Database,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  Sliders,
  Play,
  FileCheck
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { generateSyntheticDataset, getDownloadUrl, GeneratorResponse } from "@/lib/api";

export default function GeneratorPage() {
  const [transactionCount, setTransactionCount] = useState<number>(1000);
  const [anomalyRate, setAnomalyRate] = useState<number>(0.05);
  const [seed, setSeed] = useState<number>(12345);

  const [anomalies, setAnomalies] = useState({
    missing_settlement: true,
    duplicate_settlement: true,
    amount_mismatch: true,
    refund_mismatch: true,
    fee_anomaly: true,
    delayed_settlement: true,
    orphan_settlement: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratorResponse | null>(null);

  const toggleAnomaly = (key: keyof typeof anomalies) => {
    setAnomalies((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateSyntheticDataset({
        transaction_count: transactionCount,
        anomaly_rate: anomalyRate,
        seed: seed,
        merchant_id: "M001",
        anomalies: anomalies,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate dataset.");
    } finally {
      setLoading(false);
    }
  };

  const ANOMALY_LABELS: Record<string, string> = {
    MISSING_SETTLEMENT: "Missing Settlements",
    DUPLICATE_SETTLEMENT: "Duplicate Settlements",
    AMOUNT_MISMATCH: "Settlement Amount Mismatch",
    REFUND_MISMATCH: "Refund Mismatch",
    FEE_ANOMALY: "Fee Anomalies",
    DELAYED_SETTLEMENT: "Delayed Settlements",
    ORPHAN_SETTLEMENT: "Orphan Settlements",
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Synthetic Benchmark Generator", isCurrent: true },
          ]}
        />

        {/* Page Hero */}
        <div className="pb-2 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Cpu className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Synthetic Benchmark Generator
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300">
                Deterministic Engine
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              Generate 100 to 100,000+ deterministic transactions with known injected anomalies and ground-truth labels for objective evaluation.
            </p>
          </div>
        </div>

        {/* Configuration Grid */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Left Column: Generator Form (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-slate-800 bg-[#0c121e] p-6 space-y-6">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
                <Sliders className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Generator Parameters</h2>
              </div>

              {/* Transaction Count */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <label className="text-slate-300 font-medium">Transaction Count</label>
                  <span className="font-mono text-blue-400 font-bold">{transactionCount.toLocaleString()}</span>
                </div>
                <input
                  type="number"
                  min={50}
                  max={100000}
                  step={100}
                  value={transactionCount}
                  onChange={(e) => setTransactionCount(Math.max(50, Math.min(100000, Number(e.target.value))))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  {[100, 1000, 5000, 10000].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTransactionCount(count)}
                      className={`text-[11px] px-2 py-0.5 rounded font-mono border transition-colors ${
                        transactionCount === count
                          ? "bg-blue-600/30 border-blue-500 text-blue-300"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {count.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anomaly Rate */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <label className="text-slate-300 font-medium">Anomaly Rate</label>
                  <span className="font-mono text-rose-400 font-bold">{(anomalyRate * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={0.20}
                  step={0.01}
                  value={anomalyRate}
                  onChange={(e) => setAnomalyRate(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 bg-slate-800 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0% (Clean)</span>
                  <span>5% (Default)</span>
                  <span>10%</span>
                  <span>20% (Max)</span>
                </div>
              </div>

              {/* Deterministic Seed */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <label className="text-slate-300 font-medium">Deterministic Seed</label>
                  <span className="text-[11px] text-slate-500">Same seed = identical dataset</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setSeed(Math.floor(Math.random() * 90000) + 10000)}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 hover:text-white transition-colors font-mono"
                    title="Randomize Seed"
                  >
                    🎲 Randomize
                  </button>
                </div>
              </div>

              {/* Anomaly Types Checklist */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Target Anomaly Categories
                </label>
                <div className="space-y-2 text-xs">
                  {[
                    { key: "missing_settlement", label: "Missing Settlements", tag: "Critical" },
                    { key: "duplicate_settlement", label: "Duplicate Settlements", tag: "Critical" },
                    { key: "amount_mismatch", label: "Settlement Amount Mismatch", tag: "High" },
                    { key: "refund_mismatch", label: "Refund Mismatch", tag: "High" },
                    { key: "fee_anomaly", label: "Fee Anomaly (Inflated MDR)", tag: "Medium" },
                    { key: "delayed_settlement", label: "Delayed Settlements (> SLA)", tag: "Medium" },
                    { key: "orphan_settlement", label: "Orphan Settlements (Unknown PID)", tag: "Critical" },
                  ].map((item) => {
                    const k = item.key as keyof typeof anomalies;
                    return (
                      <label
                        key={item.key}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={anomalies[k]}
                            onChange={() => toggleAnomaly(k)}
                            className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-slate-300">{item.label}</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {item.tag}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Error Box */}
              {error && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                disabled={loading}
                onClick={handleGenerate}
                className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center space-x-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating Synthetics...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Generate Dataset</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Results & Export Panel (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {!result ? (
              <div className="h-full min-h-[450px] rounded-xl border border-dashed border-slate-800 bg-[#0c121e]/50 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <Database className="w-12 h-12 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-300">No Dataset Generated Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Configure the parameters on the left and click &quot;Generate Dataset&quot; to synthesize realistic payments, settlements, refunds, fees, and ground truth.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/40 bg-[#0c121e] p-6 space-y-6 shadow-[0_0_30px_rgba(16,185,129,0.08)]">
                
                {/* Result Top Banner */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="font-semibold text-white text-base">Dataset Generated Successfully</span>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-blue-950/60 border border-blue-900/50 text-blue-300">
                    ID: {result.dataset_id}
                  </span>
                </div>

                {/* Primary Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 text-center space-y-1">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Total Transactions</span>
                    <p className="text-xl font-bold font-mono text-white">{result.transaction_count.toLocaleString()}</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-center space-y-1">
                    <span className="text-[10px] uppercase font-mono text-rose-400">Known Anomalies</span>
                    <p className="text-xl font-bold font-mono text-rose-300">{result.anomaly_count.toLocaleString()}</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 text-center space-y-1">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Generation Time</span>
                    <p className="text-xl font-bold font-mono text-emerald-400">{(result.generation_time_ms / 1000).toFixed(2)}s</p>
                  </div>
                </div>

                {/* Anomaly Breakdown Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Ground-Truth Injected Anomaly Breakdown
                  </h3>
                  <div className="rounded-lg border border-slate-800 overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900/90 text-slate-400 font-mono border-b border-slate-800">
                        <tr>
                          <th className="p-2.5 pl-4">Anomaly Class</th>
                          <th className="p-2.5 text-right pr-4">Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {Object.entries(result.anomaly_breakdown).map(([k, count]) => (
                          <tr key={k} className="hover:bg-slate-900/40">
                            <td className="p-2.5 pl-4 text-slate-300">{ANOMALY_LABELS[k] || k}</td>
                            <td className="p-2.5 pr-4 text-right font-bold text-slate-200">{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* File Downloads Section */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Download Generated Benchmark Files
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { key: "payments", label: "payments.csv", color: "text-blue-400" },
                      { key: "settlements", label: "settlements.csv", color: "text-emerald-400" },
                      { key: "refunds", label: "refunds.csv", color: "text-amber-400" },
                      { key: "fees", label: "fees.csv", color: "text-purple-400" },
                      { key: "ground_truth", label: "ground_truth.csv", color: "text-rose-400" },
                      { key: "metadata", label: "metadata.json", color: "text-slate-300" },
                    ].map((item) => (
                      <a
                        key={item.key}
                        href={getDownloadUrl(result.dataset_id, item.key)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs flex items-center justify-between transition-colors group"
                      >
                        <span className={`font-mono text-[11px] ${item.color}`}>{item.label}</span>
                        <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
                      </a>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </AppShell>
  );
}
