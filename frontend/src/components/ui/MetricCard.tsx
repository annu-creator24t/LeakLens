"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  subValue?: string | React.ReactNode;
  icon?: LucideIcon;
  variant?: "neutral" | "critical" | "warning" | "success" | "highlight";
  badge?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  variant = "neutral",
  badge,
  className = "",
  onClick,
}: MetricCardProps) {
  const variantStyles = {
    neutral: "border-slate-800/80 bg-[#0c121e]",
    critical: "border-rose-900/40 bg-[#140c14]",
    warning: "border-amber-900/40 bg-[#14120c]",
    success: "border-emerald-900/40 bg-[#0c1612]",
    highlight: "border-blue-900/40 bg-[#0c1424]",
  }[variant];

  const iconColors = {
    neutral: "text-slate-400 bg-slate-900",
    critical: "text-rose-400 bg-rose-950/60",
    warning: "text-amber-400 bg-amber-950/60",
    success: "text-emerald-400 bg-emerald-950/60",
    highlight: "text-blue-400 bg-blue-950/60",
  }[variant];

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-5 transition-all ${variantStyles} ${
        onClick ? "cursor-pointer hover:border-slate-700" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          {Icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColors}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">
            {label}
          </span>
        </div>
        {badge}
      </div>

      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-slate-400 mt-1 font-normal">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
