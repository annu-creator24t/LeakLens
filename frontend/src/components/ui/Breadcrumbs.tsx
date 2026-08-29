"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-1.5 text-xs text-slate-400 ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1 || item.isCurrent;

        return (
          <React.Fragment key={item.label + index}>
            {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
            {isLast || !item.href ? (
              <span className="font-medium text-slate-200 truncate max-w-xs">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-slate-200 transition-colors truncate max-w-xs"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;
