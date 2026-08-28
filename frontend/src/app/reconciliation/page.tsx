"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Clock, ShieldCheck, Database, Layers } from "lucide-react";

function ReconciliationContent() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id") || "unassigned";

  return (
    <div className="max-w-3xl mx-auto px-6 py-20 flex-1 flex flex-col justify-center items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-6 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
        <Layers className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono bg-slate-900 border border-slate-800 text-slate-400 mb-4">
        <Database className="w-3.5 h-3.5 text-blue-400" />
        <span>Session ID: {datasetId}</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
        Deterministic Reconciliation Engine
      </h1>

      <p className="text-lg font-medium text-blue-400 mb-4">
        Reconciliation engine coming in Phase 4.
      </p>

      <p className="text-sm text-slate-400 max-w-lg mb-8 leading-relaxed">
        Your uploaded financial records have been ingested, validated against strict schemas, and normalized with decimal precision. Deterministic matching and exception classification will be activated in upcoming phases.
      </p>

      <div className="flex items-center space-x-4">
        <Link
          href="/upload"
          className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-xs flex items-center space-x-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Upload Another Dataset</span>
        </Link>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col justify-between fintech-grid">
      <header className="border-b border-slate-800/80 bg-[#080b11]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
              LL
            </div>
            <span className="font-semibold text-white">LEAKLENS</span>
          </div>
          <Link
            href="/upload"
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Back to Upload
          </Link>
        </div>
      </header>

      <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading session...</div>}>
        <ReconciliationContent />
      </Suspense>

      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© 2026 LeakLens. Razorpay AI Buildathon — Track 04: AI Finance Controller.</p>
      </footer>
    </div>
  );
}
