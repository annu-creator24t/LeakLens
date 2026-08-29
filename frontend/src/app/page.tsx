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
  HelpCircle
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
      // 1. Generate realistic benchmark dataset with full anomaly coverage
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
      // 2. Redirect directly into the Dashboard with the newly reconciled dataset
      router.push(`/dashboard?dataset_id=${gen.dataset_id}`);
    } catch (err) {
      console.error("Failed to initialize demo:", err);
      router.push("/dashboard");
    } finally {
      setIsStartingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col justify-between fintech-grid">
      
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-[#080b11]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold tracking-tight text-sm shadow-[0_0_15px_rgba(37,99,235,0.3)]">
              LL
            </div>
            <span className="font-bold tracking-tight text-base text-white">LEAKLENS</span>
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50">
              Financial Intelligence
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleTryLeakLens}
              disabled={isStartingDemo}
              className="text-xs text-blue-300 hover:text-white font-semibold transition-all border border-blue-800/60 px-3.5 py-1.5 rounded-lg bg-blue-950/50 hover:bg-blue-900/60 flex items-center space-x-1.5 cursor-pointer shadow-[0_0_12px_rgba(37,99,235,0.15)]"
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

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16 lg:py-24 flex-1 flex flex-col justify-center">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Hero Copy & Actions */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-950/60 border border-blue-800/50 text-blue-300">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Razorpay AI Buildathon — Track 04: AI Finance Controller</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
                Find Where Your Money Doesn&apos;t Reconcile.
              </h1>
              <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed pt-1">
                LeakLens reconciles payments, settlements, refunds and fees, detects discrepancies, and helps finance teams investigate what happened.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={handleTryLeakLens}
                disabled={isStartingDemo}
                className="px-6 py-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center space-x-2.5 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.45)] cursor-pointer"
              >
                {isStartingDemo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Demo Dataset...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Try LeakLens</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>

              <Link
                href="/upload"
                className="px-6 py-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-medium text-sm transition-all flex items-center space-x-2 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                <span>Upload Financial Data</span>
              </Link>
            </div>

            {/* Guarantees / Principles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800/60 max-w-xl">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200">Deterministic Math:</strong> Strict Python Decimal calculations.
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200">Evidence Grounded:</strong> Facts verified from ledger rows.
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200">Zero Silent Loss:</strong> Flags missing & duplicate payouts.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Discrepancy Snapshot */}
          <div className="lg:col-span-5">
            <div 
              onClick={handleTryLeakLens}
              className="rounded-xl border border-slate-800 bg-[#0c121e] p-6 shadow-2xl space-y-6 relative overflow-hidden group hover:border-blue-700/60 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Discrepancy Snapshot
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  Demo dataset
                </span>
              </div>

              {/* Primary Discrepancy Display */}
              <div className="p-4 rounded-lg bg-rose-950/25 border border-rose-900/40 space-y-1">
                <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
                  <span className="flex items-center space-x-1.5">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Unexplained financial impact</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 font-mono font-semibold">
                    CRITICAL SEVERITY
                  </span>
                </div>
                <div className="pt-1">
                  <FinancialAmount amount={37720} size="3xl" variant="danger" />
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Reconciliation gap across 10,000 processed transactions
                </p>
              </div>

              {/* Financial Metrics Mini-Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">
                    Expected Settlement
                  </span>
                  <div className="font-mono text-sm font-semibold text-slate-200">
                    ₹74,48,220.00
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">
                    Actual Bank Payout
                  </span>
                  <div className="font-mono text-sm font-semibold text-slate-200">
                    ₹74,10,500.00
                  </div>
                </div>
              </div>

              {/* Callout button */}
              <div className="pt-2 flex items-center justify-between text-xs text-blue-400 group-hover:text-blue-300 font-medium">
                <span>Click to launch live interactive investigation</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Landing Page Story Section */}
      <section className="border-t border-slate-800/80 bg-[#0a0e17]/80 py-20 px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Payments tell one story. Settlements sometimes tell another.
            </h2>
            <p className="text-sm text-slate-400">
              When payment gateways capture transactions, discrepancies silently accumulate in fee deductions, delayed payouts, and unrecorded settlements.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Story Card 1 */}
            <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e] space-y-4">
              <div className="w-10 h-10 rounded-lg bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400 font-bold">
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
              <div className="pt-2 p-3 rounded-lg bg-slate-950/60 border border-slate-850 font-mono text-[11px] space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Captured:</span>
                  <span className="text-emerald-400">₹24,850.00</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Settlement:</span>
                  <span className="text-rose-400 font-bold">NOT FOUND</span>
                </div>
              </div>
            </div>

            {/* Story Card 2 */}
            <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e] space-y-4">
              <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">
                  Refund recorded, deduction doesn&apos;t match
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  A partial or full customer refund was issued, but the gateway deducted more (or less) from your payout than recorded.
                </p>
              </div>
              <div className="pt-2 p-3 rounded-lg bg-slate-950/60 border border-slate-850 font-mono text-[11px] space-y-1">
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
            <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e] space-y-4">
              <div className="w-10 h-10 rounded-lg bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400 font-bold">
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
              <div className="pt-2 p-3 rounded-lg bg-slate-950/60 border border-slate-850 font-mono text-[11px] space-y-1">
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

      {/* Three Core Promises Section */}
      <section className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Reconciliation + Financial Intelligence + Investigation
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            A three-stage pipeline built specifically for finance and operations teams.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          <div className="space-y-3 p-6 rounded-xl border border-slate-800 bg-[#0c121e]/40">
            <div className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>01. DETECT</span>
            </div>
            <h3 className="text-lg font-bold text-white">Find discrepancies automatically.</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deterministic matching identifies missing payouts, duplicate entries, fee anomalies, and refund mismatches across millions in transaction volume.
            </p>
          </div>

          <div className="space-y-3 p-6 rounded-xl border border-slate-800 bg-[#0c121e]/40">
            <div className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>02. EXPLAIN</span>
            </div>
            <h3 className="text-lg font-bold text-white">Understand what happened using structured evidence.</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Investigation briefs synthesize raw ledger rows into clear causal chains with confirmed ledger facts and transparent hypotheses.
            </p>
          </div>

          <div className="space-y-3 p-6 rounded-xl border border-slate-800 bg-[#0c121e]/40">
            <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>03. ACT</span>
            </div>
            <h3 className="text-lg font-bold text-white">Track investigation through resolution.</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Manage dispute priorities in the Action Center, record audit-compliant notes, and generate formal PDF reconciliation packages.
            </p>
          </div>

        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="border-t border-slate-800/80 bg-[#0a0e17] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-white">Ready to inspect your reconciliation ledger?</h3>
            <p className="text-xs text-slate-400 mt-0.5">Explore the pre-generated 10,000-record benchmark or upload CSVs.</p>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={handleTryLeakLens}
              disabled={isStartingDemo}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Try LeakLens Demo</span>
            </button>
            <Link
              href="/upload"
              className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              Upload CSV
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#080b11] py-6 px-6 text-center text-xs text-slate-400 font-mono">
        LeakLens Financial Intelligence Engine • Deterministic Reconciliation + AI Investigation
      </footer>

    </div>
  );
}
