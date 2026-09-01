"use client";

import React, { useState } from "react";
import { Info } from "lucide-react";

export interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  iconOnly?: boolean;
  className?: string;
}

export function Tooltip({
  content,
  children,
  iconOnly = false,
  className = "",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className={`relative inline-flex items-center group cursor-help ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="tooltip"
      aria-label={content}
    >
      {children}
      {iconOnly && (
        <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 ml-1 transition-colors shrink-0" />
      )}

      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-lg bg-slate-900 border border-slate-750 text-[11px] font-sans font-normal text-slate-200 shadow-2xl z-50 pointer-events-none text-center leading-relaxed">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
}
