"use client";

import React from "react";
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Receipt,
  Scale,
  Clock,
  Layers,
  Info
} from "lucide-react";
import { ExceptionItem } from "@/lib/api";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { SeverityBadge } from "@/components/ui/Badges";

interface DeterministicExplanationProps {
  exception: ExceptionItem;
}

export function DeterministicExplanation({ exception }: DeterministicExplanationProps) {
  const ev = exception.evidence || {};
  const excType = exception.exception_type;
  const paymentId = exception.payment_id || "N/A";
  const discrepancy = exception.amount_discrepancy;
  const expectedSettlement = exception.expected_settlement ?? 0;
  const actualSettlement = exception.actual_settlement ?? 0;

  // Derive deterministic rule, expected/actual metrics, evidence checklist, and category based on exception type
  let ruleText = "";
  let expectedLabel = "Expected Settlement";
  let expectedValue: number | string = expectedSettlement;
  let actualLabel = "Actual Settlement";
  let actualValue: number | string = actualSettlement;
  let diffLabel = "Verified Difference";
  let diffValue = discrepancy;
  let passedEvidence: string[] = [];
  let failedEvidence: string[] = [];
  let finalResultCategory = exception.exception_type.replace(/_/g, " ");

  switch (excType) {
    case "AMOUNT_MISMATCH":
      ruleText = "Actual settlement payout received does not match the expected net settlement calculated from captured gross, contractual MDR fees, and recorded refunds.";
      expectedLabel = "Expected Payout";
      expectedValue = expectedSettlement;
      actualLabel = "Actual Payout";
      actualValue = actualSettlement;
      diffLabel = "Verified Difference";
      diffValue = discrepancy;
      passedEvidence = [
        `Payment capture '${paymentId}' recorded with status SUCCESS`,
        ev.payment_amount !== undefined
          ? `Gross captured amount verified at ₹${Number(ev.payment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
          : "Transaction record identified on ledger",
        `Expected settlement payout calculated at ₹${Number(expectedSettlement).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      ];
      failedEvidence = [
        `Actual credited settlement (₹${Number(actualSettlement).toLocaleString("en-IN", { minimumFractionDigits: 2 })}) differs from expected payout by ₹${Number(discrepancy).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      ];
      finalResultCategory = "AMOUNT MISMATCH";
      break;

    case "MISSING_SETTLEMENT":
      ruleText = "Payment transaction capture was successfully completed and recorded, but zero corresponding settlement records were found in the bank deposit payout batches.";
      expectedLabel = "Expected Settlement";
      expectedValue = expectedSettlement;
      actualLabel = "Actual Settlement";
      actualValue = 0;
      diffLabel = "Uncredited Amount";
      diffValue = discrepancy;
      passedEvidence = [
        `Payment reference '${paymentId}' verified on transactions ledger`,
        ev.payment_amount !== undefined
          ? `Captured gross payment of ₹${Number(ev.payment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
          : "Gross capture validated",
        `Expected net settlement calculated at ₹${Number(expectedSettlement).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      ];
      failedEvidence = [
        "Zero settlement batch records found matching payment reference in bank payout export",
      ];
      finalResultCategory = "MISSING SETTLEMENT";
      break;

    case "DUPLICATE_SETTLEMENT":
      ruleText = "Multiple distinct bank settlement payout records were credited against the same payment capture reference, resulting in duplicate payout disbursements.";
      expectedLabel = "Expected Settlements";
      expectedValue = `1 record (₹${Number(expectedSettlement).toLocaleString("en-IN", { minimumFractionDigits: 2 })})`;
      actualLabel = "Actual Settlements";
      actualValue = `${ev.duplicate_count || 2} records (₹${Number(actualSettlement).toLocaleString("en-IN", { minimumFractionDigits: 2 })})`;
      diffLabel = "Excess Disbursement";
      diffValue = discrepancy;
      passedEvidence = [
        `Payment capture '${paymentId}' identified on transactions ledger`,
        "Primary settlement batch record matched and accounted for",
      ];
      failedEvidence = [
        `Multiple (${ev.duplicate_count || 2}) settlement credits detected for single capture reference '${paymentId}'`,
      ];
      finalResultCategory = "DUPLICATE SETTLEMENT";
      break;

    case "REFUND_MISMATCH":
      ruleText = "Settlement deduction for refund does not match the authorized refund amount or was deducted without a corresponding refund record.";
      expectedLabel = "Expected Refund Impact";
      expectedValue = expectedSettlement;
      actualLabel = "Actual Settlement";
      actualValue = actualSettlement;
      diffLabel = "Refund Discrepancy";
      diffValue = discrepancy;
      passedEvidence = [
        `Payment reference '${paymentId}' verified on transactions ledger`,
        ev.refund_amount !== undefined
          ? `Refund recorded on ledger: ₹${Number(ev.refund_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
          : "Refund entry tracked on ledger",
      ];
      failedEvidence = [
        `Settlement deduction differs from authorized refund value by ₹${Number(discrepancy).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      ];
      finalResultCategory = "REFUND MISMATCH";
      break;

    case "UNEXPECTED_FEE":
    case "FEE_ANOMALY":
      ruleText = "Gateway fee or MDR deduction exceeds contracted fee schedule rate or includes unauthorized surcharge.";
      expectedLabel = "Contracted Fee";
      expectedValue = ev.contractual_fee !== undefined && ev.contractual_fee !== null
        ? Number(ev.contractual_fee)
        : (ev.fee_amount !== undefined && ev.fee_amount !== null ? Number(ev.fee_amount) - discrepancy : expectedSettlement);
      actualLabel = "Deducted Fee";
      actualValue = ev.fee_amount !== undefined && ev.fee_amount !== null ? Number(ev.fee_amount) : actualSettlement;
      diffLabel = "Excess Fee Deduction";
      diffValue = discrepancy;
      passedEvidence = [
        `Payment capture '${paymentId}' verified on ledger`,
        "Standard contractual MDR rate schedule evaluated",
      ];
      failedEvidence = [
        `Gateway fee deduction exceeds contracted rate schedule by ₹${Number(discrepancy).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      ];
      finalResultCategory = "FEE ANOMALY (EXCESS MDR)";
      break;

    case "DELAYED_SETTLEMENT":
      ruleText = "Time elapsed between payment capture and gateway bank payout credit exceeded the maximum agreed settlement SLA window.";
      expectedLabel = "SLA Window";
      expectedValue = "T+2 Business Days (48h)";
      actualLabel = "Elapsed Duration";
      actualValue = ev.delay_days !== undefined ? `${ev.delay_days} days elapsed` : "SLA Breach";
      diffLabel = "Discrepancy Impact";
      diffValue = discrepancy;
      passedEvidence = [
        "Payment capture timestamp verified",
        "Bank deposit settlement credit timestamp confirmed",
      ];
      failedEvidence = [
        `Settlement latency exceeded standard contractual settlement SLA window (Delay: ${ev.delay_days || 4}+ days)`,
      ];
      finalResultCategory = "DELAYED SETTLEMENT (SLA BREACH)";
      break;

    case "ORPHAN_SETTLEMENT":
      ruleText = "Bank payout batch contains a settlement credit referencing a payment ID that has no corresponding capture in the merchant transactions ledger.";
      expectedLabel = "Captured Payment";
      expectedValue = "Valid merchant capture";
      actualLabel = "Bank Payout";
      actualValue = actualSettlement;
      diffLabel = "Unmatched Settlement";
      diffValue = discrepancy;
      passedEvidence = [
        "Bank deposit settlement batch record parsed and verified",
      ];
      failedEvidence = [
        `Payment reference '${paymentId}' not found in captured transactions ledger`,
      ];
      finalResultCategory = "ORPHAN SETTLEMENT";
      break;

    default:
      ruleText = exception.description || "Deterministic rule evaluation flagged a financial invariant violation.";
      passedEvidence = [`Payment ID: ${paymentId}`];
      failedEvidence = [`Discrepancy of ₹${Number(discrepancy).toLocaleString("en-IN", { minimumFractionDigits: 2 })} identified on ledger`];
      break;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c121e] p-6 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-blue-400">
              WHY THIS WAS FLAGGED
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-semibold flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>100% Deterministic Verification</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Exact rule-based reconciliation evaluation derived directly from ledger evidence (zero probabilistic reasoning).
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <SeverityBadge severity={exception.severity} size="sm" />
        </div>
      </div>

      {/* 3-Column Comparison Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Expected */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
          <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
            {expectedLabel}
          </span>
          <div className="text-base font-bold font-mono text-slate-100">
            {typeof expectedValue === "number" ? (
              <FinancialAmount amount={expectedValue} size="base" />
            ) : (
              <span>{expectedValue}</span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 block">Contractual / Calculated Payout</span>
        </div>

        {/* Actual */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
          <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
            {actualLabel}
          </span>
          <div className="text-base font-bold font-mono text-slate-100">
            {typeof actualValue === "number" ? (
              <FinancialAmount amount={actualValue} size="base" />
            ) : (
              <span>{actualValue}</span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 block">Bank Gateway Recorded Value</span>
        </div>

        {/* Difference */}
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1.5">
          <span className="text-[10px] uppercase font-mono text-rose-400 font-semibold block">
            {diffLabel}
          </span>
          <div className="text-base font-bold font-mono text-rose-300">
            <FinancialAmount amount={diffValue} size="base" variant="danger" />
          </div>
          <span className="text-[10px] text-rose-400/80 block">Unreconciled Variance</span>
        </div>
      </div>

      {/* Detection Rule */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-300 block">
          Detection Rule
        </span>
        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/90 text-xs text-slate-200 leading-relaxed font-sans">
          {ruleText}
        </div>
      </div>

      {/* Evidence Checked (Passed vs Failed) */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-300 block">
          Evidence Checked
        </span>
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs font-mono">
          {passedEvidence.map((item, idx) => (
            <div key={`pass-${idx}`} className="flex items-start space-x-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-slate-200">{item}</span>
            </div>
          ))}
          {failedEvidence.map((item, idx) => (
            <div key={`fail-${idx}`} className="flex items-start space-x-2 text-rose-400">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-rose-200 font-medium">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Final Deterministic Result */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
            Final Deterministic Result
          </span>
          <div className="text-sm font-bold font-mono text-white tracking-wide">
            {finalResultCategory}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono text-slate-400">
            Validated by Python Decimal Ledger Engine
          </span>
        </div>
      </div>
    </div>
  );
}
