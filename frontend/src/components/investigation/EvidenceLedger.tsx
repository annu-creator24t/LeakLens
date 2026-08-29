"use client";

import React from "react";
import { ArrowDown, CreditCard, Landmark, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { SeverityBadge } from "@/components/ui/Badges";

export interface EvidenceStep {
  title: string;
  subtitle: string;
  amount?: number;
  status: string;
  statusType?: "success" | "warning" | "danger" | "neutral";
  details?: Array<{ label: string; value: string | React.ReactNode }>;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface EvidenceLedgerProps {
  steps: EvidenceStep[];
  className?: string;
}

export function EvidenceLedger({ steps, className = "" }: EvidenceLedgerProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
          Causal Ledger Trail
        </h4>
        <span className="text-[10px] font-mono text-slate-500">Deterministic Flow</span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;

          const statusStyles = {
            success: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50",
            warning: "bg-amber-950/40 text-amber-400 border-amber-800/50",
            danger: "bg-rose-950/40 text-rose-400 border-rose-800/50",
            neutral: "bg-slate-900 text-slate-400 border-slate-800",
          }[step.statusType || "neutral"];

          const dotStyles = {
            success: "bg-emerald-500",
            warning: "bg-amber-500",
            danger: "bg-rose-500",
            neutral: "bg-slate-500",
          }[step.statusType || "neutral"];

          return (
            <div key={idx} className="relative group">
              {/* Timeline marker */}
              <div
                className={`absolute -left-[1.85rem] top-1.5 w-4 h-4 rounded-full border-2 border-[#080b11] ${dotStyles} shadow-[0_0_8px_rgba(0,0,0,0.5)]`}
              />

              <div className="p-4 rounded-xl border border-slate-800 bg-[#0c121e] hover:border-slate-700 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                      {step.title}
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-200">
                      {step.subtitle}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {step.amount !== undefined && (
                      <FinancialAmount amount={step.amount} size="sm" variant="neutral" />
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${statusStyles}`}>
                      {step.status}
                    </span>
                  </div>
                </div>

                {step.details && step.details.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {step.details.map((d, dIdx) => (
                      <div key={dIdx} className="text-[11px] p-2 rounded bg-slate-950/50 border border-slate-850">
                        <span className="text-slate-500 block text-[10px] uppercase font-mono">{d.label}</span>
                        <span className="text-slate-200 font-mono font-medium truncate block">{d.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EvidenceLedger;
