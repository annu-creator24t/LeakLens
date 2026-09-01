"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  CheckCircle2,
  Receipt,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  FileText,
  Play,
  ArrowRight,
  X,
  Layers,
  HelpCircle
} from "lucide-react";
import Link from "next/link";

interface GettingStartedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDemo?: () => void;
  loadingDemo?: boolean;
}

const ONBOARDING_STEPS = [
  {
    step: 1,
    title: "Import Financial Records",
    icon: FileSpreadsheet,
    desc: "Upload CSV exports for payments, bank settlements, refunds, and gateway fees. No data is modified.",
  },
  {
    step: 2,
    title: "Schema Validation & Quality Checks",
    icon: CheckCircle2,
    desc: "Automated schema mapping and deterministic validation ensure clean data before processing.",
  },
  {
    step: 3,
    title: "Deterministic Reconciliation",
    icon: Receipt,
    desc: "Mathematical comparison between captured orders and bank payouts using exact Python Decimal arithmetic.",
  },
  {
    step: 4,
    title: "Review Discrepancy Queue",
    icon: AlertTriangle,
    desc: "Identify 7 exception types including missing settlements, amount mismatches, and fee anomalies.",
  },
  {
    step: 5,
    title: "Explain & Investigate",
    icon: Sparkles,
    desc: "Inspect 100% deterministic 'Why This Was Flagged' breakdowns alongside AI-assisted root causes.",
  },
  {
    step: 6,
    title: "Triage in Action Center",
    icon: ShieldCheck,
    desc: "Manage exception lifecycles, mark items investigating/resolved, and maintain immutable audit logs.",
  },
  {
    step: 7,
    title: "Audit-Ready Financial Reports",
    icon: FileText,
    desc: "Generate professional PDF executive summaries and CSV exports for controllers and auditors.",
  },
];

export function GettingStartedModal({
  isOpen,
  onClose,
  onLoadDemo,
  loadingDemo = false,
}: GettingStartedModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem("leaklens_hide_onboarding_guide", "true");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0c121e] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold font-mono">
              LL
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-semibold">
                  WELCOME TO LEAKLENS
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-[10px] font-mono text-slate-400">First-Time Guide</span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                Financial Reconciliation Lifecycle
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Steps List */}
        <div className="p-6 overflow-y-auto space-y-3.5 divide-y divide-slate-850">
          <p className="text-xs text-slate-400 leading-relaxed pb-1">
            LeakLens automates revenue leakage detection by verifying that every customer payment is settled in full by payment gateways and acquiring banks.
          </p>

          <div className="pt-3 space-y-3">
            {ONBOARDING_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="flex items-start space-x-3.5 p-2.5 rounded-xl hover:bg-slate-900/40 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 font-mono text-xs font-semibold">
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                      <span>{item.title}</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span>Don&apos;t show this guide on startup</span>
          </label>

          <div className="flex items-center space-x-3 self-end sm:self-auto">
            {onLoadDemo && (
              <button
                type="button"
                disabled={loadingDemo}
                onClick={() => {
                  handleClose();
                  onLoadDemo();
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <Play className={`w-3.5 h-3.5 ${loadingDemo ? "animate-spin text-blue-400" : "fill-slate-300"}`} />
                <span>{loadingDemo ? "Loading Demo..." : "Explore Demo Data"}</span>
              </button>
            )}

            <Link
              href="/upload"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-colors shadow-sm cursor-pointer"
            >
              <span>Import Your CSVs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
