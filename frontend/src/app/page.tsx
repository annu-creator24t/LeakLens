"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ShieldAlert, 
  ArrowRight, 
  CheckCircle2, 
  Activity, 
  Layers, 
  Cpu, 
  FileSpreadsheet, 
  Search,
  Sparkles,
  TrendingDown,
  Play,
  FileText,
  ShieldCheck,
  Zap,
  Loader2
} from "lucide-react";
import { checkBackendHealth, generateSyntheticDataset, fetchAvailableDatasets } from "@/lib/api";

export default function LandingPage() {
  const router = useRouter();
  const [backendHealth, setBackendHealth] = useState<{ status: string; service: string } | null>(null);
  const [isStartingDemo, setIsStartingDemo] = useState(false);

  useEffect(() => {
    checkBackendHealth().then((res) => setBackendHealth(res));
  }, []);

  const handleTryLeakLens = async () => {
    setIsStartingDemo(true);
    try {
      // 1. Generate realistic benchmark dataset with anomalies
      const gen = await generateSyntheticDataset({
        transaction_count: 500,
        anomaly_rate: 0.05,
        seed: 12345,
        merchant_id: "MERCHANT_DEMO_01",
        anomalies: {
          missing_settlement: true,
          duplicate_settlement: true,
          amount_mismatch: true,
          refund_mismatch: true,
          fee_anomaly: true,
          delayed_settlement: true,
          orphan_settlement: true,
        }
      });
      // 2. Redirect directly into the Dashboard with the newly reconciled dataset
      router.push(`/dashboard?dataset_id=${gen.dataset_id}`);
    } catch (err) {
      console.error("Failed to initialize demo:", err);
      // Fallback redirect to dashboard
      router.push("/dashboard");
    } finally {
      setIsStartingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col justify-between fintech-grid">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-[#080b11]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold tracking-wider text-sm shadow-[0_0_15px_rgba(37,99,235,0.2)]">
              LL
            </div>
            <span className="font-semibold tracking-tight text-lg text-white">LEAKLENS</span>
            <span className="text-xs uppercase tracking-widest text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/50">
              Production Ready
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleTryLeakLens}
              disabled={isStartingDemo}
              className="text-xs text-blue-300 hover:text-white font-medium transition-all border border-blue-800/60 px-3.5 py-1.5 rounded-lg bg-blue-950/50 hover:bg-blue-900/60 flex items-center space-x-1.5 shadow-[0_0_12px_rgba(37,99,235,0.2)]"
            >
              {isStartingDemo ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                  <span>Loading Demo...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-blue-400 fill-blue-400" />
                  <span>Try LeakLens</span>
                </>
              )}
            </button>

            <Link
              href="/upload"
              className="text-xs text-slate-300 hover:text-white transition-colors border border-slate-800 px-3 py-1.5 rounded-lg bg-slate-900"
            >
              Upload Data
            </Link>

            <Link
              href="/dashboard"
              className="text-xs text-slate-300 hover:text-white transition-colors border border-slate-800 px-3 py-1.5 rounded-lg bg-slate-900"
            >
              Dashboard
            </Link>

            {/* Backend Health Badge */}
            <div className="hidden sm:flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${backendHealth?.status === "ok" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span className="text-slate-400">
                Backend: {backendHealth?.status === "ok" ? "Operational" : "Checking..."}
              </span>
            </div>

            <a
              href="https://github.com/annu-creator24t/LeakLens.git"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-white transition-colors border border-slate-800 px-3 py-1.5 rounded-lg hover:border-slate-700 bg-slate-900/50"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-16 lg:py-24 flex-1 flex flex-col justify-center">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Hero Copy & Actions */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-950/60 border border-blue-800/50 text-blue-300">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Razorpay AI Buildathon — Track 04: AI Finance Controller</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
                LEAKLENS
              </h1>
              <p className="text-2xl sm:text-3xl font-medium text-slate-300 tracking-tight">
                See where your money leaks.
              </p>
              <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed pt-2">
                Deterministic financial reconciliation engine and evidence-grounded AI intelligence that verifies payments, settlements, fees, and refunds to uncover lost revenue.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={handleTryLeakLens}
                disabled={isStartingDemo}
                className="px-6 py-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center space-x-2.5 transition-all shadow-[0_0_20px_rgba(37,99,235,0.35)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] cursor-pointer"
              >
                {isStartingDemo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Demo Dataset...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Try LeakLens (1-Click Demo)</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>

              <Link
                href="/upload"
                className="px-6 py-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-medium text-sm transition-all flex items-center space-x-2 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                <span>Upload Financial CSVs</span>
              </Link>
            </div>

            {/* Guarantees / Principles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800/60 max-w-xl">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200">Deterministic Math:</strong> Strict Python Decimal rules.
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200">Evidence Grounded:</strong> Zero LLM money hallucinations.
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200">Zero Silent Loss:</strong> Preserves orphan ledger items.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Financial Discrepancy Preview Card */}
          <div className="lg:col-span-5">
            <div 
              onClick={handleTryLeakLens}
              className="rounded-xl border border-slate-800 bg-[#0d131f] p-6 shadow-2xl space-y-6 relative overflow-hidden group hover:border-blue-700/60 transition-all cursor-pointer"
            >
              {/* Subtle top indicator bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-rose-500 to-amber-500" />
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Live Discrepancy Snapshot
                  </span>
                </div>
                <span className="text-xs font-mono text-blue-400 group-hover:underline flex items-center space-x-1">
                  <span>Explore Live</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>

              {/* Primary Discrepancy Display */}
              <div className="p-4 rounded-lg bg-rose-950/25 border border-rose-900/40 space-y-1">
                <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
                  <span className="flex items-center space-x-1.5">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Unexplained Money Leakage</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 font-mono font-semibold">
                    CRITICAL SEVERITY
                  </span>
                </div>
                <div className="text-3xl font-bold text-white tracking-tight font-mono">
                  ₹37,720.00
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Reconciliation gap across 10,000 processed transactions
                </p>
              </div>

              {/* Financial Metrics Mini-Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/60 space-y-1">
                  <span className="text-slate-400">Total Volume</span>
                  <p className="font-semibold text-slate-200 font-mono">₹10,00,000.00</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/60 space-y-1">
                  <span className="text-slate-400">Reconciled Rate</span>
                  <p className="font-semibold text-emerald-400 font-mono">95.00%</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/60 space-y-1">
                  <span className="text-slate-400">Expected Settlement</span>
                  <p className="font-semibold text-slate-200 font-mono">₹9,72,000.00</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/60 space-y-1">
                  <span className="text-slate-400">Actual Settlement</span>
                  <p className="font-semibold text-slate-200 font-mono">₹9,34,280.00</p>
                </div>
              </div>

              {/* AI Insight Snippet */}
              <div className="p-3.5 rounded-lg bg-blue-950/30 border border-blue-900/40 text-xs space-y-1.5">
                <div className="flex items-center space-x-1.5 text-blue-400 font-medium">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>AI Investigation Root-Cause</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  12 successful payments (₹12,400) missing settlement credit beyond $T+2$ SLA. 4 duplicate fee deductions identified.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* 7-Step Complete Financial Intelligence Journey */}
        <div className="mt-20 pt-12 border-t border-slate-800/70">
          <div className="text-center space-y-2 mb-10">
            <div className="text-xs uppercase tracking-widest text-blue-400 font-semibold">
              End-to-End Financial Intelligence Workflow
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              From Ingestion to Audit Report in 7 Seamless Steps
            </h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                01
              </div>
              <h3 className="font-semibold text-sm text-slate-200">1. Ingest & Validate</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload Payments, Settlements, Refunds, and Fees CSVs with automatic schema matching.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                02
              </div>
              <h3 className="font-semibold text-sm text-slate-200">2. Deterministic Recon</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Auditable mathematical verification comparing Expected vs. Actual settlement amounts.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">
                03
              </div>
              <h3 className="font-semibold text-sm text-slate-200">3. Exception Classifier</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Flags 7 exact exception types: Missing payouts, duplicate fees, and refund discrepancies.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs">
                04
              </div>
              <h3 className="font-semibold text-sm text-slate-200">4. Grounded AI Investigation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Explains root-causes and generates evidence-backed summaries without hallucinating funds.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-xs">
                05
              </div>
              <h3 className="font-semibold text-sm text-slate-200">5. Ask LeakLens (NL)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ask natural language questions: &quot;Why is today&apos;s settlement lower?&quot; with live ledger evidence.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                06
              </div>
              <h3 className="font-semibold text-sm text-slate-200">6. Action Center Triage</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Prioritize high-impact issues, assign states (OPEN $\rightarrow$ RESOLVED), and record audit logs.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2.5 col-span-1 sm:col-span-2 lg:col-span-2">
              <div className="w-8 h-8 rounded-lg bg-rose-600/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-xs">
                07
              </div>
              <h3 className="font-semibold text-sm text-slate-200">7. Publication-Ready Reports & Export</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Download comprehensive PDF audit reports and formula-injection safe CSV ledgers for finance teams.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© 2026 LeakLens. Razorpay AI Buildathon — Track 04: AI Finance Controller.</p>
      </footer>
    </div>
  );
}
