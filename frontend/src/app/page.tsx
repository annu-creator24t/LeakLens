"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
  TrendingDown
} from "lucide-react";
import { checkBackendHealth } from "@/lib/api";

export default function LandingPage() {
  const [backendHealth, setBackendHealth] = useState<{ status: string; service: string } | null>(null);

  useEffect(() => {
    checkBackendHealth().then((res) => setBackendHealth(res));
  }, []);

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
            <span className="text-xs uppercase tracking-widest text-slate-500 font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
              Phase 1
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Backend Health Badge */}
            <div className="flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
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
              GitHub Repository
            </a>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-20 lg:py-28 flex-1 flex flex-col justify-center">
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
                AI-powered settlement intelligence that reconciles payments, refunds, fees and settlements to uncover financial discrepancies.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/upload"
                className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center space-x-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.45)] cursor-pointer"
              >
                <span>Analyze Your Data</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/upload"
                className="px-6 py-3 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-medium text-sm transition-all cursor-pointer"
              >
                View Demo
              </Link>
            </div>

            {/* Guarantees / Principles */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-800/60 max-w-lg">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200">Deterministic Math:</strong> Strict financial calculation rules.
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-400 leading-snug">
                  <strong className="text-slate-200">Evidence Grounded:</strong> Zero LLM monetary hallucinations.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Financial Discrepancy Preview Card */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-6 shadow-2xl space-y-6 relative overflow-hidden">
              {/* Subtle top indicator bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-rose-500 to-amber-500" />
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Reconciliation Live Snapshot
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-500">Demo Preview</span>
              </div>

              {/* Primary Discrepancy Display */}
              <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-900/30 space-y-1">
                <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
                  <span className="flex items-center space-x-1.5">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Unexplained Discrepancy Detected</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/50 text-rose-300 font-mono">
                    23 Exceptions
                  </span>
                </div>
                <div className="text-3xl font-bold text-white tracking-tight font-mono">
                  ₹37,720.00
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Reconciliation gap across 9,842 processed transactions
                </p>
              </div>

              {/* Financial Metrics Mini-Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/60 space-y-1">
                  <span className="text-slate-400">Total Volume</span>
                  <p className="font-semibold text-slate-200 font-mono">₹10,00,000</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/60 space-y-1">
                  <span className="text-slate-400">Reconciled Rate</span>
                  <p className="font-semibold text-emerald-400 font-mono">95.77%</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/60 space-y-1">
                  <span className="text-slate-400">Expected Settlement</span>
                  <p className="font-semibold text-slate-200 font-mono">₹9,72,000</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/60 space-y-1">
                  <span className="text-slate-400">Actual Settlement</span>
                  <p className="font-semibold text-slate-200 font-mono">₹9,41,500</p>
                </div>
              </div>

              {/* AI Insight Snippet */}
              <div className="p-3.5 rounded-lg bg-blue-950/20 border border-blue-900/30 text-xs space-y-1.5">
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

        {/* 3-Pillar Architecture Section */}
        <div className="mt-20 pt-12 border-t border-slate-800/70">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold text-center mb-8">
            The 3-Pillar Settlement Intelligence Workflow
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">1. Ingest & Normalize</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ingests raw payments, settlements, refunds, and fees CSV datasets. Validates types and standardizes currency schemas.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">2. Deterministic Reconciliation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Auditable mathematical verification classifying 7 exact exception types: missing payouts, duplicate fees, and refund mismatches.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">3. Grounded AI Investigation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generates evidence-backed explanations, prioritizes high-value triage queues, and answers merchant questions without hallucinations.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© 2026 LeakLens. Razorpay AI Buildathon — Track 04: AI Finance Controller. Phase 1 Foundation.</p>
      </footer>
    </div>
  );
}
