"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Info, ShieldAlert, ShieldCheck } from "lucide-react";

export interface SeverityBadgeProps {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function SeverityBadge({ severity, size = "sm", showIcon = true }: SeverityBadgeProps) {
  const norm = (severity || "").toUpperCase();

  const config = {
    CRITICAL: {
      bg: "bg-rose-950/50",
      text: "text-rose-400",
      border: "border-rose-800/60",
      icon: AlertCircle,
      label: "Critical",
    },
    HIGH: {
      bg: "bg-amber-950/50",
      text: "text-amber-400",
      border: "border-amber-800/60",
      icon: AlertTriangle,
      label: "High",
    },
    MEDIUM: {
      bg: "bg-blue-950/40",
      text: "text-blue-400",
      border: "border-blue-800/50",
      icon: Info,
      label: "Medium",
    },
    LOW: {
      bg: "bg-slate-900/60",
      text: "text-slate-400",
      border: "border-slate-800",
      icon: Clock,
      label: "Low",
    },
  }[norm] || {
    bg: "bg-slate-900",
    text: "text-slate-400",
    border: "border-slate-800",
    icon: Info,
    label: severity,
  };

  const IconComponent = config.icon;
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center space-x-1 rounded-md font-medium tracking-tight border ${config.bg} ${config.text} ${config.border} ${padding}`}
    >
      {showIcon && <IconComponent className={size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />}
      <span className="font-mono uppercase font-semibold">{config.label}</span>
    </span>
  );
}

export interface StatusBadgeProps {
  status: "OPEN" | "INVESTIGATING" | "UNDER_REVIEW" | "RESOLVED" | "IGNORED" | string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const norm = (status || "").toUpperCase();

  const config = {
    OPEN: {
      bg: "bg-rose-950/40",
      text: "text-rose-400",
      border: "border-rose-800/50",
      label: "Open",
      dot: "bg-rose-500",
    },
    INVESTIGATING: {
      bg: "bg-amber-950/40",
      text: "text-amber-400",
      border: "border-amber-800/50",
      label: "Investigating",
      dot: "bg-amber-500 animate-pulse",
    },
    UNDER_REVIEW: {
      bg: "bg-amber-950/40",
      text: "text-amber-400",
      border: "border-amber-800/50",
      label: "Investigating",
      dot: "bg-amber-500 animate-pulse",
    },
    RESOLVED: {
      bg: "bg-emerald-950/40",
      text: "text-emerald-400",
      border: "border-emerald-800/50",
      label: "Resolved",
      dot: "bg-emerald-500",
    },
    IGNORED: {
      bg: "bg-slate-900/60",
      text: "text-slate-400",
      border: "border-slate-800",
      label: "Ignored",
      dot: "bg-slate-500",
    },
  }[norm] || {
    bg: "bg-slate-900",
    text: "text-slate-300",
    border: "border-slate-800",
    label: status,
    dot: "bg-slate-400",
  };

  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center space-x-1.5 rounded-md font-medium border ${config.bg} ${config.text} ${config.border} ${padding}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}

export interface EvidencePillProps {
  label: string;
  count?: number | string;
  href?: string;
  variant?: "neutral" | "highlight" | "danger" | "verified";
  onClick?: () => void;
}

export function EvidencePill({
  label,
  count,
  href,
  variant = "neutral",
  onClick,
}: EvidencePillProps) {
  const variantStyles = {
    neutral: "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white",
    highlight: "bg-blue-950/50 text-blue-300 border-blue-800/60 hover:border-blue-700 hover:bg-blue-950/80",
    danger: "bg-rose-950/40 text-rose-300 border-rose-800/50 hover:border-rose-700",
    verified: "bg-emerald-950/40 text-emerald-300 border-emerald-800/50",
  }[variant];

  const content = (
    <span
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs border font-medium transition-all ${variantStyles} ${
        onClick || href ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      {variant === "verified" && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
      <span>{label}</span>
      {count !== undefined && (
        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-400">
          {count}
        </span>
      )}
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
