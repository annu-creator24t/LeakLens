"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  FileText,
  FileSpreadsheet,
  Cpu,
  Activity,
  Database,
  ChevronDown,
  PlusCircle,
  Play,
  ArrowRight,
  ExternalLink,
  Layers
} from "lucide-react";
import { fetchAvailableDatasets, generateSyntheticDataset, DatasetItem } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/exceptions", label: "Exceptions", icon: AlertTriangle },
  { href: "/action-center", label: "Action Center", icon: ShieldCheck },
  { href: "/investigate", label: "Ask LeakLens", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: FileText },
];

const SECONDARY_NAV = [
  { href: "/upload", label: "Import Data", icon: FileSpreadsheet },
  { href: "/generator", label: "Benchmark Data", icon: Cpu },
  { href: "/evaluation", label: "Model Evaluation", icon: Activity },
];

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentDatasetId = searchParams.get("dataset_id") || "";

  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>(currentDatasetId);
  const [isDatasetOpen, setIsDatasetOpen] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    if (currentDatasetId && currentDatasetId !== selectedDataset) {
      setSelectedDataset(currentDatasetId);
    }
  }, [currentDatasetId]);

  const loadDatasets = async () => {
    try {
      const res = await fetchAvailableDatasets();
      setDatasets(res.datasets);
      if (!currentDatasetId && res.datasets.length > 0) {
        const first = res.datasets[0].dataset_id;
        setSelectedDataset(first);
      }
    } catch {
      // Ignored
    }
  };

  const handleSelectDataset = (id: string) => {
    setSelectedDataset(id);
    setIsDatasetOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("dataset_id", id);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleGenerate10kDemo = async () => {
    setLoadingDemo(true);
    try {
      const gen = await generateSyntheticDataset({
        transaction_count: 10000,
        anomaly_rate: 0.05,
        seed: 12345,
        merchant_id: "M001",
        anomalies: {
          missing_settlement: true,
          duplicate_settlement: true,
          amount_mismatch: true,
          refund_mismatch: true,
          fee_anomaly: true,
          delayed_settlement: true,
          orphan_settlement: true,
        },
      });
      await loadDatasets();
      handleSelectDataset(gen.dataset_id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDemo(false);
    }
  };

  const activeDatasetObj = datasets.find((d) => d.dataset_id === selectedDataset);
  const isDemoActive = activeDatasetObj?.type === "BENCHMARK" || selectedDataset.includes("demo") || selectedDataset.includes("sync");

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col md:flex-row fintech-grid">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#0a0e17] border-r border-slate-800/80 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Brand */}
          <div className="p-5 border-b border-slate-800/80">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold tracking-tight text-sm shadow-sm">
                LL
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-white block">LEAKLENS</span>
                <span className="text-[10px] text-slate-400 font-mono tracking-tight">Financial Intelligence</span>
              </div>
            </Link>
          </div>

          {/* Primary Navigation Links */}
          <div className="p-3">
            <div className="text-[10px] uppercase font-mono text-slate-400 px-3 py-1.5 font-semibold">
              Reconciliation
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                const hrefWithParams = selectedDataset ? `${item.href}?dataset_id=${selectedDataset}` : item.href;
                return (
                  <Link
                    key={item.href}
                    href={hrefWithParams}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-blue-600/15 text-blue-400 border border-blue-600/30 font-semibold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="text-[10px] uppercase font-mono text-slate-400 px-3 pt-5 pb-1.5 font-semibold">
              Data & Benchmarking
            </div>
            <nav className="space-y-1">
              {SECONDARY_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                const hrefWithParams = selectedDataset ? `${item.href}?dataset_id=${selectedDataset}` : item.href;
                return (
                  <Link
                    key={item.href}
                    href={hrefWithParams}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-blue-600/15 text-blue-400 border border-blue-600/30 font-semibold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer / Demo Trigger */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium">10k Benchmark</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50 font-mono">
                1-Click
              </span>
            </div>
            <button
              type="button"
              disabled={loadingDemo}
              onClick={handleGenerate10kDemo}
              className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Play className={`w-3 h-3 ${loadingDemo ? "animate-spin" : "fill-white"}`} />
              <span>{loadingDemo ? "Synthesizing 10k..." : "Load 10k Demo"}</span>
            </button>
          </div>
          
          <div className="text-[10px] text-slate-400 text-center font-mono">
            Track 04: AI Finance Controller
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Global Topbar */}
        <header className="h-16 border-b border-slate-800/80 bg-[#080b11]/90 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
          
          {/* Active Dataset Selector */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDatasetOpen(!isDatasetOpen)}
                className="flex items-center space-x-2.5 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-400">Dataset:</span>
                <span className="font-mono font-semibold text-white truncate max-w-[180px]">
                  {activeDatasetObj?.name || selectedDataset || "Select Session"}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {isDatasetOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-[#0c121e] border border-slate-800 rounded-xl shadow-2xl p-2 z-50 space-y-1">
                  <div className="text-[10px] uppercase font-mono text-slate-400 px-2 py-1 font-semibold">
                    Financial Datasets
                  </div>
                  {datasets.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500 font-mono">
                      No datasets found. Load 10k demo or import CSVs.
                    </div>
                  ) : (
                    datasets.map((d) => (
                      <button
                        key={d.dataset_id}
                        type="button"
                        onClick={() => handleSelectDataset(d.dataset_id)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                          selectedDataset === d.dataset_id
                            ? "bg-blue-950/60 text-blue-300 border border-blue-800/50"
                            : "hover:bg-slate-900 text-slate-300"
                        }`}
                      >
                        <div className="truncate pr-2">
                          <p className="font-semibold text-slate-100">{d.name}</p>
                          <p className="text-[10px] font-mono text-slate-400">{d.dataset_id}</p>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                          {d.transaction_count} txs
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Demo dataset active pill */}
            {isDemoActive && (
              <span className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider font-semibold bg-amber-950/50 text-amber-300 border border-amber-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>DEMO DATA</span>
              </span>
            )}
          </div>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center space-x-3">
            <Link
              href={selectedDataset ? `/exceptions?dataset_id=${selectedDataset}&severity=CRITICAL` : "/exceptions"}
              className="text-xs text-rose-400 hover:text-rose-300 border border-rose-900/50 px-3 py-1.5 rounded-lg bg-rose-950/40 flex items-center space-x-1.5 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Critical Exceptions</span>
              <span className="sm:hidden">Critical</span>
            </Link>

            <Link
              href="/upload"
              className="text-xs text-slate-200 hover:text-white border border-slate-800 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Import CSV</span>
            </Link>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-fade-in">
          {children}
        </main>
      </div>

    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080b11] flex items-center justify-center text-slate-500 font-mono text-xs">
          Loading LeakLens Shell...
        </div>
      }
    >
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  );
}
