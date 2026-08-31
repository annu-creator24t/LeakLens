"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowRight, 
  CheckCircle2, 
  Activity, 
  Layers, 
  FileSpreadsheet, 
  Search,
  Sparkles,
  TrendingDown,
  Play,
  FileText,
  ShieldCheck,
  Zap,
  Loader2,
  AlertTriangle,
  Receipt,
  HelpCircle,
  Database,
  Calculator,
  Lock,
  Clock,
  ExternalLink,
  ChevronRight,
  BarChart3
} from "lucide-react";
import { checkBackendHealth, generateSyntheticDataset } from "@/lib/api";
import { FinancialAmount } from "@/components/ui/FinancialAmount";

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
      // Generate realistic benchmark dataset with full anomaly coverage
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
        },
      });
      // Redirect directly into the Dashboard with the newly reconciled dataset
      router.push(`/dashboard?dataset_id=${gen.dataset_id}`);
    } catch (err) {
      console.error("Failed to initialize demo:", err);
      router.push("/dashboard");
    } finally {
      setIsStartingDemo(false);
    }
  };

  const WORKFLOW_STEPS = [
    {
      step: "01",
      title: "Financial Data",
      desc: "Payments, settlements, refunds, and gateway fee records ingested and validated.",
      icon: Database,
      tag: "Ingestion"
    },
    {
      step: "02",
      title: "Reconciliation",
      desc: "Deterministic Python Decimal matching across all ledger streams with 0% float drift.",
      icon: Calculator,
      tag: "Deterministic"
    },
    {
      step: "03",
      title: "Unexplained Leakage",
      desc: "Mathematical isolation of net variance between expected and actual bank credits.",
      icon: TrendingDown,
      tag: "Detection"
    },
    {
      step: "04",
      title: "Evidence Facts",
      desc: "Raw immutable ledger rows structured into verifiable mathematical audit facts.",
      icon: Receipt,
      tag: "Verification"
    },
    {
      step: "05",
      title: "AI Root Cause",
      desc: "Grounded investigative briefs explaining gateway anomalies without calculating math in prompts.",
      icon: Sparkles,
      tag: "Investigation"
    },
    {
      step: "06",
      title: "Action Center",
      desc: "Dispute lifecycle management from OPEN → INVESTIGATING → RESOLVED with audit logging.",
      icon: Activity,
      tag: "Resolution"
    },
    {
      step: "07",
      title: "Audit Report",
      desc: "Executive PDF packages and formula-escaped CSV exports ready for CFOs and auditors.",
      icon: FileText,
      tag: "Compliance"
    }
  ];

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col justify-between fintech-grid">
      
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-[#080b11]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold tracking-tight text-sm shadow-sm">
              LL
            </div>
            <span className="font-bold tracking-tight text-base text-white">LEAKLENS</span>
            <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50">
              Financial Intelligence
            </span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={handleTryLeakLens}
              disabled={isStartingDemo}
              className="text-xs text-blue-300 hover:text-white font-semibold transition-all border border-blue-800/60 px-3 py-1.5 rounded-lg bg-blue-950/50 hover:bg-blue-900/60 flex items-center space-x-1.5 cursor-pointer shadow-sm"
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
              className="hidden sm:inline-block text-xs text-slate-300 hover:text-white transition-colors border border-slate-800 px-3 py-1.5 rounded-lg bg-slate-900"
            >
              Dashboard
            </Link>

            {/* Backend Health Badge */}
            <div className="hidden md:flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${backendHealth?.status === "ok" ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="text-slate-400">
                Backend: {backendHealth?.status === "ok" ? "Operational" : "Checking..."}
              </span>
            </div>

            <a
              href="https://github.com/annu-creator24t/LeakLens.git"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:inline-flex text-xs text-slate-400 hover:text-white transition-colors border border-slate-800 px-3 py-1.5 rounded-lg hover:border-slate-700 bg-slate-900/50 items-center space-x-1"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-20 flex-1 flex flex-col justify-center">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Hero Copy & Actions */}
          <div className="lg:col-span-7 space-y-7">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-950/60 border border-blue-800/50 text-blue-300">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Razorpay AI Buildathon — Track 04: AI Finance Controller</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
                Deterministic Financial Reconciliation & Leakage Detection.
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-400 max-w-xl leading-relaxed">
                LeakLens reconciles payment captures, bank settlements, customer refunds, and gateway fees with 0% float drift. Detect unexplained discrepancies and investigate root causes using evidence-grounded AI.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <button
                onClick={handleTryLeakLens}
                disabled={isStartingDemo}
                className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center space-x-2.5 transition-all shadow-md cursor-pointer"
              >
                {isStartingDemo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Demo Dataset...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Try LeakLens (Instant Demo)</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>

              <Link
                href="/upload"
                className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-700/80 font-medium text-sm transition-all flex items-center space-x-2 cursor-pointer shadow-sm hover:border-slate-600"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                <span>Upload Financial Data</span>
              </Link>
            </div>

            {/* Guarantees / Core Invariants */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-5 border-t border-slate-800/60 max-w-xl">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200 block">Deterministic Math</strong>
                  Python Decimal arithmetic with 0% float drift.
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200 block">Evidence Grounded</strong>
                  Strictly verified against immutable ledger rows.
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200 block">Zero Silent Loss</strong>
                  7 automated anomaly and discrepancy detectors.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Discrepancy Snapshot */}
          <div className="lg:col-span-5">
            <div 
              onClick={handleTryLeakLens}
              className="rounded-2xl border border-slate-800 bg-[#0c121e] p-6 shadow-xl space-y-5 relative overflow-hidden group hover:border-blue-700/60 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Reconciliation Snapshot
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  10K Benchmark Dataset
                </span>
              </div>

              {/* Primary Discrepancy Display */}
              <div className="p-4 rounded-xl bg-rose-950/25 border border-rose-900/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
                  <span className="flex items-center space-x-1.5">
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                    <span>Unexplained Difference</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 font-mono font-semibold">
                    CRITICAL SEVERITY
                  </span>
                </div>
                <div className="pt-0.5">
                  <FinancialAmount amount={37720} size="3xl" variant="danger" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Calculated variance across 10,000 reconciled transactions
                </p>
              </div>

              {/* Financial Metrics Mini-Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">
                    Expected Settlement
                  </span>
                  <div className="font-mono text-sm font-semibold text-slate-200">
                    ₹74,48,220.00
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">
                    Actual Settlement
                  </span>
                  <div className="font-mono text-sm font-semibold text-slate-200">
                    ₹74,10,500.00
                  </div>
                </div>
              </div>

              {/* Exception Distribution Pill preview */}
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-850 space-y-2 text-xs">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Detected Anomaly Classes</span>
                  <span className="text-blue-400 font-semibold">7 Types Isolated</span>
                </div>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/50 text-rose-300">Missing Payouts</span>
                  <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300">Fee Anomalies</span>
                  <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/50 text-purple-300">Duplicate Credits</span>
                  <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/50 text-blue-300">Refund Mismatches</span>
                </div>
              </div>

              {/* Callout Action button */}
              <div className="pt-1 flex items-center justify-between text-xs text-blue-400 group-hover:text-blue-300 font-medium">
                <span>Click to launch interactive investigation</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 7-Step Financial Reconciliation Pipeline */}
      <section className="border-t border-slate-800/80 bg-[#0a0e17]/90 py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-10">
          
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400">
              End-to-End Control Pipeline
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              The 7-Step Financial Reconciliation Journey
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              How LeakLens transforms raw merchant data streams into verified audit packages.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.slice(0, 4).map((step, idx) => {
              const IconComp = step.icon;
              return (
                <div 
                  key={idx} 
                  className="p-5 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-3 relative hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {step.tag}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span className="font-mono text-blue-400">{step.step}.</span>
                      <span>{step.title}</span>
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {WORKFLOW_STEPS.slice(4).map((step, idx) => {
              const IconComp = step.icon;
              return (
                <div 
                  key={idx} 
                  className="p-5 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-3 relative hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {step.tag}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span className="font-mono text-purple-400">{step.step}.</span>
                      <span>{step.title}</span>
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Real Merchant Failure Modes Section */}
      <section className="border-t border-slate-800/80 bg-[#080b11] py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-10">
          
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-rose-400">
              Real Merchant Failure Modes
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Payments tell one story. Settlements sometimes tell another.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              When payment gateways capture transactions, discrepancies silently accumulate in fee deductions, delayed payouts, and unrecorded settlements.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Story Card 1 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-4 hover:border-slate-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400 font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">
                  Payment captured, settlement missing
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your payment gateway marked the transaction as successful, but no corresponding bank payout record was ever received.
                </p>
              </div>
              <div className="pt-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-850 font-mono text-[11px] space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Captured:</span>
                  <span className="text-emerald-400 font-semibold">₹24,850.00</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Settlement:</span>
                  <span className="text-rose-400 font-bold">NOT FOUND</span>
                </div>
              </div>
            </div>

            {/* Story Card 2 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-4 hover:border-slate-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">
                  Refund recorded, deduction mismatch
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  A partial or full customer refund was issued, but the gateway deducted more (or less) from your payout than recorded.
                </p>
              </div>
              <div className="pt-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-850 font-mono text-[11px] space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Refund Amount:</span>
                  <span>₹5,000.00</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Deduction:</span>
                  <span className="text-amber-400 font-bold">₹7,250.00</span>
                </div>
              </div>
            </div>

            {/* Story Card 3 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-4 hover:border-slate-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400 font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">
                  Fee deducted, expected fee differs
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The contracted Merchant Discount Rate (MDR) was 2%, but gateway charges and taxes quietly drained extra margin.
                </p>
              </div>
              <div className="pt-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-850 font-mono text-[11px] space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Expected MDR:</span>
                  <span>2.0% (₹200.00)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Deducted MDR:</span>
                  <span className="text-rose-400 font-bold">3.4% (₹340.00)</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Deterministic Reconciliation vs Grounded AI Architecture Section */}
      <section className="border-t border-slate-800/80 bg-[#0a0e17]/90 py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-10">
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
              System Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Deterministic Math + Grounded AI Investigation
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Why LeakLens never relies on LLMs for calculations, yet leverages AI for causal explanation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Engine 1: Deterministic */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Deterministic Reconciliation Engine</h3>
                  <span className="text-[10px] font-mono text-slate-400">Mathematical Ledger Authority</span>
                </div>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>Exact Python <code className="text-blue-300 font-mono">Decimal</code> arithmetic preventing floating point precision errors.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>Rule-based anomaly detection evaluating 7 distinct financial exception algorithms.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>Idempotent execution: identical datasets always yield 100% identical balances.</span>
                </li>
              </ul>
            </div>

            {/* Engine 2: AI Investigator */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-[#0c121e] space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Grounded AI Investigation Controller</h3>
                  <span className="text-[10px] font-mono text-slate-400">Structured Root Cause Synthesis</span>
                </div>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>Zero arithmetic in prompts: LLM reasons over pre-calculated verified ledger evidence.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>Structured investigation briefs with confirmed facts vs hypotheses distinction.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>Multi-tenant dataset isolation: AI query planner prevents prompt injection & data leaks.</span>
                </li>
              </ul>
            </div>

          </div>

        </div>
      </section>

      {/* Enterprise Security & Trust Grid */}
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
            Trust & Security Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Engineered for High-Volume Financial Control
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-slate-800 bg-[#0c121e]/50 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Dataset Isolation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strict multi-tenant partitioning preventing cross-session or cross-merchant data leakage.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-[#0c121e]/50 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">CSV Injection Defense</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated escaping of formula injection triggers (<code className="font-mono text-emerald-400">=, +, -, @</code>) during CSV export.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-[#0c121e]/50 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">10K Benchmark Tested</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sub-second reconciliation and reporting benchmarked across 10,000 live transaction batches.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-[#0c121e]/50 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Audit Timeline</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every status change, auditor note, and resolution logged with ISO-8601 timestamps and actors.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="border-t border-slate-800/80 bg-[#0a0e17] py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-bold text-white">Ready to inspect your reconciliation ledger?</h3>
            <p className="text-xs text-slate-400">Launch the pre-configured 10,000-record benchmark or upload CSVs directly.</p>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={handleTryLeakLens}
              disabled={isStartingDemo}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center space-x-2 transition-colors cursor-pointer shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Try LeakLens Demo</span>
            </button>
            <Link
              href="/upload"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              Upload CSVs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#080b11] py-6 px-4 sm:px-6 text-center text-xs text-slate-400 font-mono">
        LeakLens Financial Intelligence Engine • Deterministic Reconciliation + AI Investigation • Razorpay AI Buildathon 2026
      </footer>

    </div>
  );
}
