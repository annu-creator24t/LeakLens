"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Sparkles, HelpCircle, Activity } from "lucide-react";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { SeverityBadge, StatusBadge } from "@/components/ui/Badges";

export interface InvestigationBriefProps {
  exceptionType: string;
  exceptionTitle: string;
  severity: string;
  status: string;
  amountDiscrepancy: number;
  paymentId?: string;
  whatHappened: string;
  evidencePoints: Array<{ label: string; verified: boolean; detail?: string }>;
  possibleCauses: string[];
  recommendedNextStep: string;
  onStartInvestigation?: () => void;
  onResolve?: () => void;
  actionLoading?: boolean;
}

export function InvestigationBrief({
  exceptionType,
  exceptionTitle,
  severity,
  status,
  amountDiscrepancy,
  paymentId,
  whatHappened,
  evidencePoints,
  possibleCauses,
  recommendedNextStep,
  onStartInvestigation,
  onResolve,
  actionLoading = false,
}: InvestigationBriefProps) {
  const isResolved = status === "RESOLVED";
  const isInvestigating = status === "INVESTIGATING" || status === "UNDER_REVIEW";

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c121e] overflow-hidden shadow-xl">
      
      {/* Top Banner Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 font-mono text-xs font-bold">
            IB
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 font-semibold">
                INVESTIGATION BRIEF
              </span>
              <span className="text-slate-600">•</span>
              <SeverityBadge severity={severity} size="sm" />
              <StatusBadge status={status} size="sm" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
              {exceptionTitle}
            </h2>
          </div>
        </div>

        {/* Financial Impact Highlight */}
        <div className="sm:text-right bg-slate-950/60 border border-slate-800/80 px-4 py-2 rounded-lg">
          <span className="text-[10px] uppercase font-mono text-slate-400 block">
            Potentially Unexplained
          </span>
          <FinancialAmount amount={amountDiscrepancy} size="lg" variant="danger" />
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="p-6 grid md:grid-cols-12 gap-6">
        
        {/* Left Column: What Happened & Evidence */}
        <div className="md:col-span-7 space-y-6">
          
          {/* Section: WHAT HAPPENED */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>What Happened</span>
            </h3>
            <div className="p-3.5 rounded-lg bg-slate-900/40 border border-slate-800/80 text-xs text-slate-200 leading-relaxed">
              {whatHappened || "Deterministic reconciliation detected a financial mismatch between ledger records."}
            </div>
          </div>

          {/* Section: EVIDENCE LEDGER FACTS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono tracking-wider text-emerald-400 uppercase flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Evidence ({evidencePoints.length} Facts)</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Deterministic Truth</span>
            </div>

            <div className="p-3.5 rounded-lg bg-emerald-950/15 border border-emerald-900/30 space-y-2">
              {evidencePoints.map((item, idx) => (
                <div key={idx} className="flex items-start space-x-2 text-xs text-slate-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-snug">
                    <span className="font-medium text-slate-100">{item.label}</span>
                    {item.detail && <span className="text-slate-400 ml-1.5 font-mono text-[11px]">— {item.detail}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Possible Causes & Next Step */}
        <div className="md:col-span-5 space-y-6 flex flex-col justify-between">
          
          <div className="space-y-6">
            {/* Section: POSSIBLE CAUSES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono tracking-wider text-amber-400 uppercase flex items-center space-x-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Possible Causes</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-500">AI Hypothesis</span>
              </div>

              <div className="p-3.5 rounded-lg bg-amber-950/15 border border-amber-900/30 space-y-2">
                {possibleCauses.map((cause, idx) => (
                  <div key={idx} className="flex items-start space-x-2 text-xs text-slate-300">
                    <span className="text-amber-400 font-bold shrink-0">•</span>
                    <span className="leading-snug">{cause}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section: RECOMMENDED NEXT STEP */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold font-mono tracking-wider text-blue-400 uppercase flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Recommended Next Step</span>
              </h3>
              <div className="p-3.5 rounded-lg bg-blue-950/20 border border-blue-900/40 text-xs text-blue-200 leading-relaxed font-medium">
                {recommendedNextStep || "Review gateway settlement reports and bank transaction records."}
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-slate-800/80">
            {!isInvestigating && !isResolved && onStartInvestigation && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={onStartInvestigation}
                className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Start Investigation</span>
              </button>
            )}

            {!isResolved && onResolve && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={onResolve}
                className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Resolve Issue</span>
              </button>
            )}

            {isResolved && (
              <div className="w-full py-2 px-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center justify-center space-x-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Investigation Resolved</span>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}

export default InvestigationBrief;
