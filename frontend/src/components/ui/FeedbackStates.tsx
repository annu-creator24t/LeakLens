"use client";

import React from "react";
import { Loader2, AlertTriangle, Inbox, RefreshCw } from "lucide-react";

export interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingState({
  message = "Loading financial overview...",
  subMessage = "Accessing deterministic ledger evidence",
  size = "md",
  className = "",
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "p-6",
    md: "p-12",
    lg: "p-20",
  }[size];

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-[#0a0e17]/60 flex flex-col items-center justify-center text-center space-y-3 ${sizeClasses} ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-200">{message}</p>
        {subMessage && <p className="text-xs text-slate-500 mt-1 font-mono">{subMessage}</p>}
      </div>
    </div>
  );
}

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = "Something went wrong while loading this dataset.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`p-4 rounded-xl bg-rose-950/30 border border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-300 ${className}`}
    >
      <div className="flex items-center space-x-2.5">
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-800/50 text-rose-200 border border-rose-700/50 font-medium flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`p-12 rounded-xl border border-dashed border-slate-800 bg-[#0a0e17]/30 flex flex-col items-center justify-center text-center space-y-4 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
        <Icon className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {description && <p className="text-xs text-slate-400 max-w-sm">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
