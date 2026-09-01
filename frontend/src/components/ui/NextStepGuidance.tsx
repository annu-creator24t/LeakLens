"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, Sparkles, X, Lightbulb } from "lucide-react";
import Link from "next/link";

export interface NextStepGuidanceProps {
  storageKey?: string;
  stepNumber?: number;
  totalSteps?: number;
  title?: string;
  guidance: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function NextStepGuidance({
  storageKey,
  stepNumber,
  totalSteps,
  title = "Next Step",
  guidance,
  actionText,
  actionHref,
  onAction,
  className = "",
}: NextStepGuidanceProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (storageKey) {
      const isDismissed = localStorage.getItem(`leaklens_dismiss_${storageKey}`);
      if (isDismissed === "true") {
        setDismissed(true);
      }
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    if (storageKey) {
      localStorage.setItem(`leaklens_dismiss_${storageKey}`, "true");
    }
  };

  if (dismissed) return null;

  return (
    <div
      className={`p-3.5 rounded-xl bg-blue-950/30 border border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm ${className}`}
    >
      <div className="flex items-start sm:items-center space-x-3">
        <div className="w-6 h-6 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 sm:mt-0">
          <Lightbulb className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px] text-blue-400">
              {title}
            </span>
            {stepNumber && totalSteps && (
              <span className="text-[10px] font-mono text-slate-500">
                ({stepNumber}/{totalSteps})
              </span>
            )}
          </div>
          <p className="text-slate-300 mt-0.5 leading-relaxed">{guidance}</p>
        </div>
      </div>

      <div className="flex items-center space-x-2.5 self-start sm:self-auto shrink-0 pl-9 sm:pl-0">
        {actionText && actionHref && (
          <Link
            href={actionHref}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <span>{actionText}</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
        {actionText && onAction && !actionHref && (
          <button
            type="button"
            onClick={onAction}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <span>{actionText}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition-colors"
          title="Dismiss guidance"
          aria-label="Dismiss guidance"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
