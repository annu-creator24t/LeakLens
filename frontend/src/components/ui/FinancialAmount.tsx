"use client";

import React from "react";

interface FinancialAmountProps {
  amount: number | string | undefined | null;
  currency?: string;
  variant?: "neutral" | "negative" | "positive" | "danger" | "muted";
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
  showSign?: boolean;
  className?: string;
}

export function formatIndianCurrency(num: number): string {
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  // Strict Indian numbering format (e.g. 1,25,000.00)
  const formatted = absNum.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? "-" : ""}₹${formatted}`;
}

export function FinancialAmount({
  amount,
  currency = "₹",
  variant = "neutral",
  size = "base",
  showSign = false,
  className = "",
}: FinancialAmountProps) {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return <span className="font-mono text-slate-400">₹0.00</span>;
  }

  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const isNegative = num < 0;
  const isZero = num === 0;

  const sizeClasses = {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg font-semibold",
    xl: "text-xl font-bold tracking-tight",
    "2xl": "text-2xl font-bold tracking-tight",
    "3xl": "text-3xl sm:text-4xl font-bold tracking-tight",
  }[size];

  const variantClasses = {
    neutral: "text-slate-100",
    positive: "text-emerald-400",
    negative: "text-rose-400",
    danger: "text-rose-400",
    muted: "text-slate-400",
  }[variant];

  const formattedStr = formatIndianCurrency(num);

  return (
    <span
      className={`font-mono tabular-nums inline-flex items-baseline ${sizeClasses} ${variantClasses} ${className}`}
      title={formattedStr}
    >
      {showSign && num > 0 && "+"}
      {formattedStr}
    </span>
  );
}

export default FinancialAmount;
