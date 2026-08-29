"use client";

import React from "react";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  actions,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}>
      <div>
        <div className="flex items-center space-x-2.5">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-slate-400 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center space-x-3 shrink-0">{actions}</div>}
    </div>
  );
}

export default SectionHeader;
