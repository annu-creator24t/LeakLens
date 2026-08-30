"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Layers,
  FileCheck,
  Table,
  Eye,
  ShieldCheck,
  ChevronRight,
  Info,
  Play,
  RotateCcw,
  Check
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  startUploadSession,
  uploadSessionFile,
  updateColumnMappings,
  validateUploadSession,
  confirmAndImportDataset,
  UploadSessionState,
  FileUploadInfo,
  ConfirmDatasetResponse
} from "@/lib/api";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingState, ErrorState } from "@/components/ui/FeedbackStates";
import { formatNumber } from "@/lib/formatters";

const REQUIRED_TARGETS: Record<string, string[]> = {
  payments: ["payment_id", "amount", "payment_status"],
  settlements: ["settlement_id", "payment_id", "settlement_amount", "settlement_status", "settlement_date"],
  refunds: ["refund_id", "payment_id", "refund_amount", "refund_status", "refund_date"],
  fees: ["payment_id", "fee_amount"],
};

const STEP_LABELS = [
  { step: 1, label: "Upload" },
  { step: 2, label: "Map" },
  { step: 3, label: "Validate" },
  { step: 4, label: "Confirm" },
  { step: 5, label: "Complete" },
];

export default function UploadPage() {
  const router = useRouter();

  const [step, setStep] = useState<number>(1);
  const [uploadId, setUploadId] = useState<string>("");
  const [session, setSession] = useState<UploadSessionState | null>(null);
  
  // File upload state
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [dragOverType, setDragOverType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Validation & Confirmation
  const [validating, setValidating] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [datasetName, setDatasetName] = useState<string>("");
  const [finalResult, setFinalResult] = useState<ConfirmDatasetResponse | null>(null);

  // Issues modal state
  const [showIssuesModal, setShowIssuesModal] = useState<boolean>(false);

  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    setError(null);
    setSession(null);
    try {
      const res = await startUploadSession();
      setUploadId(res.upload_id);
      return res.upload_id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize upload session.");
      return null;
    }
  };

  const handleFileUpload = async (fileType: string, file: File) => {
    let currentUploadId = uploadId;
    if (!currentUploadId) {
      currentUploadId = (await initSession()) || "";
      if (!currentUploadId) return;
    }
    setUploadingType(fileType);
    setError(null);
    try {
      const info = await uploadSessionFile(currentUploadId, fileType, file);
      setSession((prev) => {
        const isSameSession = prev && prev.upload_id === currentUploadId;
        const files = isSameSession ? { ...prev.files, [fileType]: info } : { [fileType]: info };
        return {
          upload_id: currentUploadId,
          status: "UPLOADING",
          files,
          validation_summaries: isSameSession ? prev.validation_summaries : {},
          issues: isSameSession ? prev.issues : [],
          created_at: isSameSession ? prev.created_at : new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_ready_to_confirm: false,
        };
      });
      setSuccessBanner(`${fileType.toUpperCase()} file uploaded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to upload ${fileType} file.`);
    } finally {
      setUploadingType(null);
    }
  };

  const handleMappingChange = (fileType: string, srcCol: string, targetField: string) => {
    if (!session || !session.files[fileType]) return;
    const activeUploadId = uploadId || session.upload_id;
    const fileInfo = session.files[fileType];
    const updatedMappings = fileInfo.column_mappings.map((m) =>
      m.source_column === srcCol
        ? { ...m, target_field: targetField, is_mapped: Boolean(targetField) }
        : m
    );

    const mappingMap: Record<string, string> = {};
    updatedMappings.forEach((m) => {
      mappingMap[m.source_column] = m.target_field;
    });

    setSession({
      ...session,
      files: {
        ...session.files,
        [fileType]: {
          ...fileInfo,
          column_mappings: updatedMappings,
        },
      },
    });

    if (activeUploadId) {
      updateColumnMappings(activeUploadId, fileType, mappingMap).catch((err) => {
        console.error("Failed to update column mapping:", err);
      });
    }
  };

  const handleRunValidation = async () => {
    const activeUploadId = uploadId || session?.upload_id;
    if (!activeUploadId) {
      setError("No active upload session. Please initialize a new session.");
      return;
    }
    if (!session?.files["payments"]) {
      setError("Payments file is required before running data validation.");
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const valState = await validateUploadSession(activeUploadId);
      setSession(valState);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    const activeUploadId = uploadId || session?.upload_id;
    if (!activeUploadId) {
      setError("No active upload session. Please initialize a new session.");
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const res = await confirmAndImportDataset(activeUploadId, datasetName.trim() || undefined);
      setFinalResult(res);
      setStep(5);
      setSuccessBanner("Dataset imported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import dataset.");
    } finally {
      setConfirming(false);
    }
  };

  // Compute validation quality stats
  let totalValid = 0;
  let totalWarnings = 0;
  let totalErrors = 0;

  if (session?.validation_summaries) {
    Object.values(session.validation_summaries).forEach((sum) => {
      totalValid += sum.valid_rows || 0;
      totalWarnings += sum.warning_count || 0;
      totalErrors += sum.error_count || 0;
    });
  }

  if (session?.issues && totalErrors === 0 && totalWarnings === 0) {
    totalWarnings = session.issues.filter((i) => i.severity === "WARNING").length;
    totalErrors = session.issues.filter((i) => i.severity === "ERROR").length;
  }

  const hasUploadedFiles = session && Object.keys(session.files).length > 0;

  return (
    <AppShell>
      <div className="space-y-8 max-w-5xl mx-auto">
        
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "Overview", href: "/dashboard" },
            { label: "Import Financial Data", isCurrent: true },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <span>Import Financial Data</span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Bring your payment, settlement, refund and fee exports.
            </p>
          </div>

          {uploadId && (
            <span className="text-xs font-mono text-slate-400 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 self-start sm:self-auto">
              Session: <strong className="text-slate-200">{uploadId}</strong>
            </span>
          )}
        </div>

        {/* 5-Step Progress Stepper */}
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0c121e]">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 -z-0" />

            {STEP_LABELS.map(({ step: sNum, label }) => {
              const isCompleted = step > sNum;
              const isCurrent = step === sNum;

              return (
                <div key={sNum} className="relative z-10 flex flex-col items-center space-y-1.5 bg-[#0c121e] px-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                      isCompleted
                        ? "bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                        : isCurrent
                        ? "bg-blue-600 text-white ring-4 ring-blue-900/40 shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                        : "bg-slate-900 text-slate-500 border border-slate-800"
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : sNum}
                  </div>
                  <span
                    className={`text-[11px] font-medium font-mono ${
                      isCurrent ? "text-blue-400 font-bold" : isCompleted ? "text-emerald-400" : "text-slate-500"
                    }`}
                  >
                    {sNum} {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-slate-400 hover:text-white text-xs font-mono"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error state */}
        {error && <ErrorState message={error} onRetry={initSession} />}

        {/* STEP 1: UPLOAD FILES */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              {(["payments", "settlements", "refunds", "fees"] as const).map((ft) => {
                const fileInfo = session?.files[ft];
                const isUploading = uploadingType === ft;
                const isDragOver = dragOverType === ft;

                return (
                  <div
                    key={ft}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverType(ft);
                    }}
                    onDragLeave={() => setDragOverType(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverType(null);
                      if (e.dataTransfer.files[0]) {
                        handleFileUpload(ft, e.dataTransfer.files[0]);
                      }
                    }}
                    className={`p-5 rounded-xl border transition-all ${
                      fileInfo
                        ? "border-emerald-900/60 bg-emerald-950/15"
                        : isDragOver
                        ? "border-blue-500 bg-blue-950/20"
                        : "border-slate-800 bg-[#0c121e] hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 block">
                          {ft} CSV
                        </span>
                        <p className="text-[11px] text-slate-400">
                          {ft === "payments" && "Captured merchant orders and gross amounts"}
                          {ft === "settlements" && "Bank payout records and settlement batch IDs"}
                          {ft === "refunds" && "Customer return and chargeback records"}
                          {ft === "fees" && "Gateway MDR deductions and tax charges"}
                        </p>
                      </div>

                      {fileInfo && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Uploaded</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                      {fileInfo ? (
                        <div className="text-xs font-mono text-slate-300 truncate max-w-[200px]">
                          {fileInfo.original_filename} ({formatNumber(fileInfo.row_count)} rows)
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">No file uploaded</div>
                      )}

                      <label className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer transition-colors flex items-center space-x-1.5">
                        <Upload className={`w-3 h-3 ${isUploading ? "animate-spin" : ""}`} />
                        <span>{isUploading ? "Uploading..." : fileInfo ? "Replace" : "Select CSV"}</span>
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileUpload(ft, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-mono">
                Upload at least your Payments & Settlements files to proceed.
              </span>

              <button
                type="button"
                disabled={!hasUploadedFiles}
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <span>Continue to Schema Mapping</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: MAP COLUMNS */}
        {step === 2 && session && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-900/40 text-xs text-blue-300 flex items-center space-x-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>Verify that source columns from your CSV exports map to the standard LeakLens financial schema.</span>
            </div>

            <div className="space-y-6">
              {Object.entries(session.files).map(([ft, info]) => (
                <div key={ft} className="rounded-xl border border-slate-800 bg-[#0c121e] p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div>
                      <h3 className="text-sm font-bold uppercase font-mono text-white">
                        {ft} Mapping
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        {info.original_filename} • {formatNumber(info.row_count)} rows
                      </p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {info.column_mappings.map((m) => (
                      <div key={m.source_column} className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 space-y-1 text-xs">
                        <span className="text-slate-400 font-mono text-[10px] uppercase block">
                          CSV Header: <strong className="text-slate-200">{m.source_column}</strong>
                        </span>
                        <select
                          value={m.target_field || ""}
                          onChange={(e) => handleMappingChange(ft, m.source_column, e.target.value)}
                          aria-label={`Target field for ${m.source_column}`}
                          className="w-full p-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono outline-none focus:border-blue-500"
                        >
                          <option value="">-- Ignore Column --</option>
                          {(REQUIRED_TARGETS[ft] || []).map((tf) => (
                            <option key={tf} value={tf}>
                              → {tf}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium cursor-pointer"
              >
                Back to Upload
              </button>

              <button
                type="button"
                disabled={validating}
                onClick={handleRunValidation}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
              >
                {validating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validating Records...</span>
                  </>
                ) : (
                  <>
                    <span>Run Data Validation</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DATA QUALITY & VALIDATION */}
        {step === 3 && (
          <div className="space-y-6">
            
            {/* Quality KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
              
              {/* Valid */}
              <div className="p-4 rounded-xl border border-emerald-900/50 bg-[#0c1612] space-y-1">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono font-bold uppercase">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valid Records</span>
                </div>
                <div className="text-2xl font-bold font-mono text-white pt-1">
                  ✓ {formatNumber(totalValid)}
                </div>
                <p className="text-[11px] text-slate-400">Strictly passed schema checks</p>
              </div>

              {/* Warnings */}
              <div className="p-4 rounded-xl border border-amber-900/50 bg-[#14120c] space-y-1">
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-mono font-bold uppercase">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Warnings</span>
                </div>
                <div className="text-2xl font-bold font-mono text-white pt-1">
                  ⚠ {formatNumber(totalWarnings)}
                </div>
                <p className="text-[11px] text-slate-400">Non-blocking formatting notes</p>
              </div>

              {/* Blocking Errors */}
              <div className="p-4 rounded-xl border border-rose-900/50 bg-[#140c14] space-y-1">
                <div className="flex items-center space-x-2 text-rose-400 text-xs font-mono font-bold uppercase">
                  <XCircle className="w-4 h-4" />
                  <span>Blocking Errors</span>
                </div>
                <div className="text-2xl font-bold font-mono text-white pt-1">
                  ❌ {formatNumber(totalErrors)}
                </div>
                <p className="text-[11px] text-slate-400">Must be zero to import</p>
              </div>

            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium cursor-pointer"
              >
                Back to Mapping
              </button>

              <button
                type="button"
                disabled={totalErrors > 0}
                onClick={() => setStep(4)}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <span>Proceed to Confirmation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

        {/* STEP 4: CONFIRM IMPORT */}
        {step === 4 && (
          <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e] space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white tracking-tight">
                Confirm & Reconcile Financial Dataset
              </h2>
              <p className="text-xs text-slate-400">
                Final step: Name your financial session to commit records into the deterministic ledger engine.
              </p>
            </div>

            <div className="space-y-2 max-w-md">
              <label className="text-xs font-medium text-slate-300 block">
                Dataset Name (Optional)
              </label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="e.g. August 2026 Merchant Settlement Export"
                className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-colors"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium cursor-pointer"
              >
                Back to Validation
              </button>

              <button
                type="button"
                disabled={confirming}
                onClick={handleConfirmImport}
                className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
              >
                {confirming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing & Reconciling...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Import & Run Reconciliation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: IMPORT COMPLETE */}
        {step === 5 && finalResult && (
          <div className="p-8 rounded-xl border border-emerald-900/60 bg-emerald-950/20 text-center space-y-6 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Dataset Successfully Imported
              </h2>
              <p className="text-xs text-slate-400">
                {finalResult.dataset_name || finalResult.dataset_id} is now reconciled and ready for investigation.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-xs text-left space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Dataset ID:</span>
                <span className="text-slate-200 font-semibold">{finalResult.dataset_id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Exceptions Detected:</span>
                <span className="text-rose-400 font-semibold">{formatNumber(finalResult.exceptions_detected)}</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href={`/dashboard?dataset_id=${finalResult.dataset_id}`}
                className="w-full py-3 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                <span>Go to Reconciliation Overview</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
