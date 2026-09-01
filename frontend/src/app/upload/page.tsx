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
  ChevronDown,
  ChevronUp,
  Info,
  Play,
  RotateCcw,
  Check,
  AlertCircle
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
  ValidationIssue,
  ConfirmDatasetResponse
} from "@/lib/api";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingState, ErrorState } from "@/components/ui/FeedbackStates";
import { formatNumber } from "@/lib/formatters";

interface SchemaFieldOption {
  key: string;
  label: string;
  isRequired: boolean;
}

const SCHEMA_TARGET_FIELDS: Record<string, SchemaFieldOption[]> = {
  payments: [
    { key: "payment_id", label: "Payment ID", isRequired: true },
    { key: "order_id", label: "Order ID", isRequired: true },
    { key: "merchant_id", label: "Merchant ID", isRequired: true },
    { key: "amount", label: "Amount", isRequired: true },
    { key: "currency", label: "Currency", isRequired: true },
    { key: "payment_status", label: "Payment Status", isRequired: true },
    { key: "payment_method", label: "Payment Method", isRequired: false },
    { key: "created_at", label: "Created At (Date)", isRequired: true },
  ],
  settlements: [
    { key: "settlement_id", label: "Settlement ID", isRequired: true },
    { key: "payment_id", label: "Payment ID", isRequired: true },
    { key: "settlement_amount", label: "Settlement Amount", isRequired: true },
    { key: "settlement_status", label: "Settlement Status", isRequired: true },
    { key: "settlement_date", label: "Settlement Date", isRequired: true },
  ],
  refunds: [
    { key: "refund_id", label: "Refund ID", isRequired: true },
    { key: "payment_id", label: "Payment ID", isRequired: true },
    { key: "refund_amount", label: "Refund Amount", isRequired: true },
    { key: "refund_status", label: "Refund Status", isRequired: true },
    { key: "refund_date", label: "Refund Date", isRequired: true },
  ],
  fees: [
    { key: "fee_id", label: "Fee ID", isRequired: false },
    { key: "payment_id", label: "Payment ID", isRequired: true },
    { key: "fee_amount", label: "Fee Amount", isRequired: true },
    { key: "tax_amount", label: "Tax Amount", isRequired: false },
    { key: "fee_type", label: "Fee Type", isRequired: false },
    { key: "fee_date", label: "Fee Date", isRequired: false },
  ],
};

const STEP_LABELS = [
  { step: 1, label: "Upload" },
  { step: 2, label: "Map" },
  { step: 3, label: "Validate" },
  { step: 4, label: "Confirm" },
  { step: 5, label: "Complete" },
];

interface GroupedValidationIssue {
  fileType: string;
  fileName: string;
  column: string;
  code: string;
  expected: string;
  message: string;
  rows: number[];
  items: ValidationIssue[];
}

function groupValidationIssues(issues: ValidationIssue[], files: Record<string, FileUploadInfo> = {}): Record<string, GroupedValidationIssue[]> {
  const byFile: Record<string, Record<string, GroupedValidationIssue>> = {};

  for (const issue of issues) {
    const ft = issue.file_type;
    const fileName = issue.file_name || files[ft]?.original_filename || `${ft}.csv`;
    if (!byFile[ft]) byFile[ft] = {};

    const groupKey = `${issue.column}_${issue.code}`;
    if (!byFile[ft][groupKey]) {
      byFile[ft][groupKey] = {
        fileType: ft,
        fileName,
        column: issue.column,
        code: issue.code,
        expected: issue.expected || "Valid formatted value",
        message: issue.message,
        rows: [],
        items: [],
      };
    }
    byFile[ft][groupKey].rows.push(issue.row_number);
    byFile[ft][groupKey].items.push(issue);
  }

  const result: Record<string, GroupedValidationIssue[]> = {};
  for (const ft of Object.keys(byFile)) {
    result[ft] = Object.values(byFile[ft]);
  }
  return result;
}

function formatRowRange(rows: number[]): string {
  if (!rows || rows.length === 0) return "";
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  if (sorted.length === 1) return `Row ${sorted[0]}`;
  const isConsecutive = sorted.every((val, idx) => idx === 0 || val === sorted[idx - 1] + 1);
  if (isConsecutive && sorted.length > 2) {
    return `Rows ${sorted[0]}–${sorted[sorted.length - 1]}`;
  }
  if (sorted.length <= 6) {
    return `Rows ${sorted.join(", ")}`;
  }
  return `Rows ${sorted.slice(0, 5).join(", ")} and ${sorted.length - 5} more`;
}

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

  // Issues accordion & group detail toggle states
  const [showBlockingErrors, setShowBlockingErrors] = useState<boolean>(true);
  const [showWarnings, setShowWarnings] = useState<boolean>(true);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>({});

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroupKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
      setSuccessBanner(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} file uploaded successfully.`);
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
    setSuccessBanner(null);
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
    setSuccessBanner(null);
    try {
      const res = await confirmAndImportDataset(activeUploadId, datasetName.trim() || undefined);
      setFinalResult(res);
      setStep(5);
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
  const errorIssues = (session?.issues || []).filter((i) => i.severity === "ERROR");
  const warningIssues = (session?.issues || []).filter((i) => i.severity === "WARNING");
  const groupedErrors = groupValidationIssues(errorIssues, session?.files || {});
  const groupedWarnings = groupValidationIssues(warningIssues, session?.files || {});

  return (
    <AppShell>
      <div className="space-y-8 max-w-5xl mx-auto">
        
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
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
            <p className="text-slate-400 text-xs mt-1">
              Upload CSV files for payments, settlements, refunds, and fees. Map the columns, validate your data, and confirm the import.
            </p>
          </div>
        </div>

        {/* 5-Step Progress Stepper */}
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0c121e]">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 -z-0" />

            {STEP_LABELS.map(({ step: sNum, label }) => {
              const isCompleted = step > sNum || (step === 5 && sNum === 5);
              const isCurrent = step === sNum && step !== 5;

              return (
                <div key={sNum} className="relative z-10 flex flex-col items-center space-y-1.5 bg-[#0c121e] px-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                      isCompleted
                        ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.25)]"
                        : isCurrent
                        ? "bg-blue-600 text-white ring-4 ring-blue-900/40 shadow-[0_0_12px_rgba(37,99,235,0.35)]"
                        : "bg-slate-900 text-slate-500 border border-slate-800"
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 text-emerald-400" /> : sNum}
                  </div>
                  <span
                    className={`text-[11px] font-medium font-mono ${
                      isCurrent ? "text-blue-400 font-bold" : isCompleted ? "text-emerald-400 font-medium" : "text-slate-500"
                    }`}
                  >
                    {sNum} {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Success Banner (Step 1 Uploads only) */}
        {step === 1 && successBanner && (
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
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 block">
                            {ft} CSV
                          </span>
                          {ft === "payments" ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/50">
                              Required
                            </span>
                          ) : ft === "settlements" ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/50">
                              Recommended
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-semibold bg-slate-900 text-slate-400 border border-slate-800">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {ft === "payments" && "Captured merchant orders and gross amounts"}
                          {ft === "settlements" && "Bank payout records and settlement batch IDs"}
                          {ft === "refunds" && "Customer return and chargeback records"}
                          {ft === "fees" && "Gateway MDR deductions and tax charges"}
                        </p>
                      </div>

                      {fileInfo && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center space-x-1 shrink-0">
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                Supported formats: UTF-8 CSV exports (up to 15 MB per file). Payments file is required; Settlements, Refunds, and Fees enable complete reconciliation.
              </span>

              <button
                type="button"
                disabled={!hasUploadedFiles}
                onClick={() => {
                  setSuccessBanner(null);
                  setStep(2);
                }}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer shrink-0 self-end sm:self-auto"
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
                          {(SCHEMA_TARGET_FIELDS[ft] || []).map((tf) => (
                            <option key={tf.key} value={tf.key}>
                              → {tf.label} {tf.isRequired ? "(Required)" : "(Optional)"}
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
                onClick={() => {
                  setSuccessBanner(null);
                  setStep(1);
                }}
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
              <div className={`p-4 rounded-xl border space-y-1 ${
                totalErrors > 0 ? "border-rose-900/50 bg-[#140c14]" : "border-slate-800 bg-[#0c121e]"
              }`}>
                <div className={`flex items-center space-x-2 text-xs font-mono font-bold uppercase ${
                  totalErrors > 0 ? "text-rose-400" : "text-slate-400"
                }`}>
                  <XCircle className="w-4 h-4" />
                  <span>Blocking Errors</span>
                </div>
                <div className="text-2xl font-bold font-mono text-white pt-1">
                  {totalErrors > 0 ? `❌ ${formatNumber(totalErrors)}` : "✓ 0"}
                </div>
                <p className="text-[11px] text-slate-400">
                  {totalErrors > 0 ? "Must be zero to import" : "Clean — ready to import"}
                </p>
              </div>

            </div>

            {/* EXPANDABLE SECTION: GROUPED BLOCKING ERRORS */}
            {totalErrors > 0 && (
              <div className="rounded-xl border border-rose-900/60 bg-[#140c12] overflow-hidden transition-all shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowBlockingErrors(!showBlockingErrors)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-rose-950/30 transition-colors border-b border-rose-950/40 cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-rose-900/40 border border-rose-700/50 flex items-center justify-center text-rose-400 shrink-0">
                      <XCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold font-mono text-rose-300 uppercase tracking-wide">
                          Blocking Error Details
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-900/80 text-rose-200 border border-rose-700/60">
                          {formatNumber(totalErrors)} {totalErrors === 1 ? "Issue" : "Issues"}
                        </span>
                      </div>
                      <p className="text-xs text-rose-400/80 mt-0.5">
                        These blocking errors must be resolved before this dataset can be confirmed and imported.
                      </p>
                    </div>
                  </div>
                  <div className="text-rose-400/80 hover:text-rose-200 p-1">
                    {showBlockingErrors ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {showBlockingErrors && (
                  <div className="p-4 space-y-4">
                    {Object.entries(groupedErrors).map(([ft, groups]) => {
                      const fileTotal = groups.reduce((acc, g) => acc + g.rows.length, 0);
                      const displayFileName = groups[0]?.fileName || `${ft}.csv`;

                      return (
                        <div key={ft} className="rounded-lg border border-rose-950/70 bg-slate-950/60 overflow-hidden">
                          {/* File header */}
                          <div className="p-3 bg-rose-950/30 border-b border-rose-950/60 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono font-bold text-rose-200">
                                {displayFileName}
                              </span>
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-rose-900/50 text-rose-300 border border-rose-800/40">
                                {ft}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-rose-300/80 font-medium">
                              {fileTotal} {fileTotal === 1 ? "blocking issue" : "blocking issues"}
                            </span>
                          </div>

                          {/* Grouped rules under this file */}
                          <div className="divide-y divide-rose-950/40">
                            {groups.map((grp) => {
                              const groupKey = `${ft}_${grp.column}_${grp.code}`;
                              const isExpanded = Boolean(expandedGroupKeys[groupKey]);

                              return (
                                <div key={groupKey} className="p-3.5 space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="space-y-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs font-semibold text-white">
                                          {grp.message}
                                        </span>
                                        <span className="text-[10px] font-mono text-amber-300 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/40">
                                          Field: {grp.column}
                                        </span>
                                        <span className="text-[10px] font-mono text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-900/50">
                                          {grp.rows.length} affected {grp.rows.length === 1 ? "record" : "records"}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-300 font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span>
                                          Expected: <strong className="text-emerald-400 font-normal bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/30">{grp.expected}</strong>
                                        </span>
                                        <span className="text-slate-400">
                                          Affected rows: <strong className="text-slate-200 font-normal">{formatRowRange(grp.rows)}</strong>
                                        </span>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => toggleGroupExpanded(groupKey)}
                                      className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-mono flex items-center space-x-1 cursor-pointer self-start sm:self-auto shrink-0 transition-colors"
                                    >
                                      <span>{isExpanded ? "Hide Records" : `View Records (${grp.rows.length})`}</span>
                                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                  </div>

                                  {/* Expandable individual rows sub-table */}
                                  {isExpanded && (
                                    <div className="pt-2 overflow-x-auto">
                                      <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                          <tr className="border-b border-rose-950/60 text-[10px] font-mono uppercase text-rose-400/80">
                                            <th className="py-1.5 px-2.5 font-semibold">Row</th>
                                            <th className="py-1.5 px-2.5 font-semibold">Invalid Value</th>
                                            <th className="py-1.5 px-2.5 font-semibold">Diagnostic Detail</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-rose-950/30 font-mono text-[11px]">
                                          {grp.items.map((item) => (
                                            <tr key={item.issue_id} className="hover:bg-rose-950/20 text-slate-300">
                                              <td className="py-1.5 px-2.5 text-slate-400 whitespace-nowrap">
                                                Row {item.row_number}
                                              </td>
                                              <td className="py-1.5 px-2.5 whitespace-nowrap">
                                                {item.raw_value !== undefined && item.raw_value !== "" ? (
                                                  <code className="text-rose-300 bg-rose-950/80 border border-rose-900/60 px-1.5 py-0.5 rounded">
                                                    {item.raw_value}
                                                  </code>
                                                ) : (
                                                  <span className="text-slate-500 italic">(empty)</span>
                                                )}
                                              </td>
                                              <td className="py-1.5 px-2.5 text-slate-300 font-sans text-xs">
                                                {item.message}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* EXPANDABLE SECTION: GROUPED WARNINGS */}
            {totalWarnings > 0 && (
              <div className="rounded-xl border border-amber-900/60 bg-[#14120c] overflow-hidden transition-all shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowWarnings(!showWarnings)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-amber-950/30 transition-colors border-b border-amber-950/40 cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-900/40 border border-amber-700/50 flex items-center justify-center text-amber-400 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold font-mono text-amber-300 uppercase tracking-wide">
                          Validation Warnings
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-900/80 text-amber-200 border border-amber-700/60">
                          {formatNumber(totalWarnings)} {totalWarnings === 1 ? "Notice" : "Notices"}
                        </span>
                      </div>
                      <p className="text-xs text-amber-400/80 mt-0.5">
                        Non-blocking potential anomalies detected (e.g. uncaptured payment references). You may proceed to import.
                      </p>
                    </div>
                  </div>
                  <div className="text-amber-400/80 hover:text-amber-200 p-1">
                    {showWarnings ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {showWarnings && (
                  <div className="p-4 space-y-3">
                    {Object.entries(groupedWarnings).map(([ft, groups]) => (
                      <div key={ft} className="rounded-lg border border-amber-950/70 bg-slate-950/60 p-3.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-amber-950/50 pb-2">
                          <span className="text-xs font-mono font-bold text-amber-200">
                            {groups[0]?.fileName || `${ft}.csv`}
                          </span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                            {ft}
                          </span>
                        </div>
                        {groups.map((grp) => (
                          <div key={`${ft}_${grp.column}_${grp.code}`} className="text-xs space-y-1 text-slate-300">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-200">{grp.message}</span>
                              <span className="text-[10px] font-mono text-slate-400">({formatRowRange(grp.rows)})</span>
                            </div>
                            <div className="text-[11px] text-amber-400/90 font-mono">
                              Expected: {grp.expected}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3 Action Bar with Explanatory Status & CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSuccessBanner(null);
                  setStep(2);
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium cursor-pointer self-start sm:self-auto"
              >
                Back to Mapping
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 self-end sm:self-auto">
                {totalErrors > 0 ? (
                  <div className="flex items-center space-x-2 text-rose-400 text-xs font-medium bg-rose-950/40 border border-rose-900/50 px-3 py-1.5 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formatNumber(totalErrors)} blocking {totalErrors === 1 ? "error" : "errors"} must be resolved before confirmation.</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-medium bg-emerald-950/40 border border-emerald-900/50 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>All records passed validation rules</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={totalErrors > 0}
                  onClick={() => {
                    setSuccessBanner(null);
                    setStep(4);
                  }}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <span>Proceed to Confirmation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
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
              <p className="text-[11px] text-slate-500">
                If left blank, LeakLens will generate a name based on the import date.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSuccessBanner(null);
                  setStep(3);
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium cursor-pointer"
              >
                Back to Validation
              </button>

              <button
                type="button"
                disabled={confirming}
                onClick={handleConfirmImport}
                className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
              >
                {confirming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing & Reconciling...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Run Reconciliation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: IMPORT COMPLETE */}
        {step === 5 && finalResult && (
          <div className="p-8 rounded-xl border border-emerald-900/60 bg-emerald-950/20 text-center space-y-6 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-emerald-600/30 border border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Dataset Successfully Imported
              </h2>
              <p className="text-xs text-slate-400">
                Your financial records are ready for reconciliation.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-left space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span>Dataset Reference:</span>
                <span className="text-slate-200 font-medium">{finalResult.dataset_name || "Financial Dataset"}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Reconciliation Status:</span>
                <span className="text-emerald-400 font-medium flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Reconciled</span>
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Exceptions Status:</span>
                {finalResult.exceptions_detected === 0 ? (
                  <span className="text-emerald-400 font-medium flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>0 Exceptions (Clean)</span>
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium">
                    {formatNumber(finalResult.exceptions_detected)} Exceptions Flagged
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2">
              <Link
                href={`/dashboard?dataset_id=${finalResult.dataset_id}`}
                className="w-full py-3 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                <span>Go to Reconciliation Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
