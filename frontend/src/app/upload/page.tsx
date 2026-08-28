"use client";

import React, { useState, useEffect } from "react";
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
  RotateCcw
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
import { formatCurrency, formatNumber } from "@/lib/formatters";

const REQUIRED_TARGETS: Record<string, string[]> = {
  payments: ["payment_id", "amount", "payment_status"],
  settlements: ["settlement_id", "payment_id", "settlement_amount", "settlement_status", "settlement_date"],
  refunds: ["refund_id", "payment_id", "refund_amount", "refund_status", "refund_date"],
  fees: ["payment_id", "fee_amount"],
};

export default function UploadPage() {
  const router = useRouter();

  const [step, setStep] = useState<number>(1);
  const [uploadId, setUploadId] = useState<string>("");
  const [session, setSession] = useState<UploadSessionState | null>(null);
  
  // File upload state
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [dragOverType, setDragOverType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validation & Confirmation
  const [validating, setValidating] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [datasetName, setDatasetName] = useState<string>("");
  const [finalResult, setFinalResult] = useState<ConfirmDatasetResponse | null>(null);

  // Issues modal state
  const [showIssuesModal, setShowIssuesModal] = useState<boolean>(false);

  // Initialize session on mount
  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    setError(null);
    try {
      const res = await startUploadSession();
      setUploadId(res.upload_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize upload session.");
    }
  };

  const handleFileUpload = async (fileType: string, file: File) => {
    if (!uploadId) return;
    setUploadingType(fileType);
    setError(null);
    try {
      const info = await uploadSessionFile(uploadId, fileType, file);
      setSession((prev) => {
        const files = prev ? { ...prev.files, [fileType]: info } : { [fileType]: info };
        return {
          upload_id: uploadId,
          status: "UPLOADING",
          files,
          validation_summaries: prev?.validation_summaries || {},
          issues: prev?.issues || [],
          created_at: prev?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_ready_to_confirm: false,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to upload ${fileType} file.`);
    } finally {
      setUploadingType(null);
    }
  };

  const handleMappingChange = (fileType: string, srcCol: string, targetField: string) => {
    if (!session || !session.files[fileType]) return;
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

    updateColumnMappings(uploadId, fileType, mappingMap).catch(() => {});
  };

  const handleRunValidation = async () => {
    if (!uploadId) return;
    setValidating(true);
    setError(null);
    try {
      const valState = await validateUploadSession(uploadId);
      setSession(valState);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!uploadId) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await confirmAndImportDataset(uploadId, datasetName.trim() || undefined);
      setFinalResult(res);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import dataset.");
    } finally {
      setConfirming(false);
    }
  };

  const hasPayments = Boolean(session?.files?.payments);

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span>Import Financial Data</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Upload merchant payment, settlement, refund, and fee exports for deterministic reconciliation.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="p-3.5 rounded-xl bg-[#0c121e] border border-slate-800 flex items-center justify-between overflow-x-auto text-xs font-mono">
          {[
            { num: 1, label: "Upload Files" },
            { num: 2, label: "Map Columns" },
            { num: 3, label: "Validate Records" },
            { num: 4, label: "Preview & Confirm" },
            { num: 5, label: "Complete" },
          ].map((st, idx) => (
            <div key={st.num} className="flex items-center space-x-2 shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === st.num
                    ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                    : step > st.num
                    ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/40"
                    : "bg-slate-900 border border-slate-800 text-slate-500"
                }`}
              >
                {step > st.num ? "✓" : st.num}
              </div>
              <span className={step >= st.num ? "text-slate-200 font-semibold" : "text-slate-500"}>
                {st.label}
              </span>
              {idx < 4 && <ChevronRight className="w-3.5 h-3.5 text-slate-700 ml-1 mr-1" />}
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* STEP 1: UPLOAD FILES */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { type: "payments", title: "1. Payments Export", desc: "Captured transactions (Mandatory)", required: true },
                { type: "settlements", title: "2. Settlements Export", desc: "Bank payout batch records", required: false },
                { type: "refunds", title: "3. Refunds Export", desc: "Customer refunds and chargebacks", required: false },
                { type: "fees", title: "4. Fees & Taxes Export", desc: "MDR deductions and GST records", required: false },
              ].map((card) => {
                const fileInfo = session?.files?.[card.type];
                const isUploading = uploadingType === card.type;
                const isDragOver = dragOverType === card.type;

                return (
                  <div
                    key={card.type}
                    onDragOver={(e) => { e.preventDefault(); setDragOverType(card.type); }}
                    onDragLeave={() => setDragOverType(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverType(null);
                      if (e.dataTransfer.files?.[0]) {
                        handleFileUpload(card.type, e.dataTransfer.files[0]);
                      }
                    }}
                    className={`p-5 rounded-xl border transition-all flex flex-col justify-between space-y-4 ${
                      isDragOver
                        ? "bg-blue-950/30 border-blue-500 shadow-lg"
                        : fileInfo
                        ? "bg-[#0c121e] border-emerald-800/60"
                        : "bg-[#0c121e] border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-white tracking-tight flex items-center space-x-1.5">
                          <span>{card.title}</span>
                          {card.required && (
                            <span className="text-[10px] text-rose-400 font-mono">*Req</span>
                          )}
                        </h3>
                        {fileInfo && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Uploaded</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{card.desc}</p>
                    </div>

                    {fileInfo ? (
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1 text-[11px] font-mono">
                        <div className="flex justify-between text-slate-300">
                          <span className="truncate max-w-[200px]">{fileInfo.original_filename}</span>
                          <span className="text-slate-500">{(fileInfo.file_size_bytes / 1024).toFixed(1)} KB</span>
                        </div>
                        <div className="text-slate-500">
                          {formatNumber(fileInfo.row_count)} rows • {fileInfo.headers.length} columns detected
                        </div>
                      </div>
                    ) : (
                      <label className="border border-dashed border-slate-700 hover:border-blue-500 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/40">
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleFileUpload(card.type, e.target.files[0]);
                          }}
                        />
                        {isUploading ? (
                          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 text-slate-500 mb-1" />
                        )}
                        <span className="text-xs font-medium text-slate-300 mt-1">
                          {isUploading ? "Uploading..." : "Click or drag CSV here"}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Max 25 MB</span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step 1 Actions */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#0c121e] border border-slate-800">
              <span className="text-xs text-slate-400">
                {hasPayments
                  ? "Payments export uploaded. Ready to review column mappings."
                  : "Please upload at least the Payments CSV export to proceed."}
              </span>

              <button
                type="button"
                disabled={!hasPayments}
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <span>Continue to Column Mapping</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: MAP COLUMNS */}
        {step === 2 && session && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 text-xs text-slate-300 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p>
                LeakLens auto-detected source column names using schema heuristics. Review and adjust any mappings below.
                Required fields are indicated with an asterisk.
              </p>
            </div>

            {Object.entries(session.files).map(([ftype, finfo]) => (
              <div key={ftype} className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {ftype} Column Mappings
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    File: {finfo.original_filename} ({finfo.row_count} rows)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 px-3">Source CSV Column</th>
                        <th className="py-2 px-3">Confidence</th>
                        <th className="py-2 px-3">Mapped LeakLens Field</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {finfo.column_mappings.map((m) => (
                        <tr key={m.source_column} className="hover:bg-slate-950/40">
                          <td className="py-2.5 px-3 font-semibold text-slate-200">
                            {m.source_column}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                              m.confidence >= 0.9 ? "bg-emerald-950 text-emerald-400" : m.confidence > 0 ? "bg-amber-950 text-amber-400" : "bg-slate-900 text-slate-500"
                            }`}>
                              {Math.round(m.confidence * 100)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={m.target_field}
                              onChange={(e) => handleMappingChange(ftype, m.source_column, e.target.value)}
                              className="p-1.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                            >
                              <option value="">-- Do Not Import --</option>
                              {m.alternatives.concat(m.target_field ? [m.target_field] : []).filter((v, i, a) => a.indexOf(v) === i).map((alt) => (
                                <option key={alt} value={alt}>
                                  {alt} {REQUIRED_TARGETS[ftype]?.includes(alt) ? "*" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#0c121e] border border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Back to Upload
              </button>

              <button
                type="button"
                disabled={validating}
                onClick={handleRunValidation}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                {validating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{validating ? "Validating..." : "Validate & Check Records"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: VALIDATE RECORDS */}
        {step === 3 && session && (
          <div className="space-y-6">
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(session.validation_summaries).map(([ftype, vsum]) => (
                <div key={ftype} className="p-4 rounded-xl bg-[#0c121e] border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase">{ftype}</span>
                    {vsum.error_count === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <div className="text-xl font-bold font-mono text-white">
                    {formatNumber(vsum.valid_rows)} <span className="text-xs text-slate-500 font-sans">/ {vsum.total_rows}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
                    <span className="text-amber-400">⚠ {vsum.warning_count} Warnings</span>
                    <span className="text-rose-400">❌ {vsum.error_count} Errors</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Validation Issues Bar */}
            {session.issues.length > 0 && (
              <div className="p-5 rounded-xl bg-[#0c121e] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Validation Issues & Warnings ({session.issues.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowIssuesModal(true)}
                    className="text-xs text-blue-400 hover:underline font-mono"
                  >
                    View Details
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {session.issues.slice(0, 5).map((iss) => (
                    <div key={iss.issue_id} className="p-2 rounded bg-slate-950 border border-slate-800/80 text-[11px] font-mono flex items-center justify-between text-slate-300">
                      <span>Row {iss.row_number} ({iss.file_type}): {iss.message}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        iss.severity === "ERROR" ? "bg-rose-950 text-rose-400" : "bg-amber-950 text-amber-400"
                      }`}>{iss.severity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 Actions */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#0c121e] border border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Back to Mappings
              </button>

              <button
                type="button"
                disabled={!session.is_ready_to_confirm}
                onClick={() => setStep(4)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <span>Preview & Confirm Import</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PREVIEW & CONFIRM */}
        {step === 4 && session && (
          <div className="space-y-6">
            
            <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Import Session Confirmation
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-400">Dataset Name (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. August Financial Settlement Export"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Sample Preview Rows */}
              {session.validation_summaries?.payments?.preview_rows?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Sample Payments (First 5 Rows):</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 px-3">Payment ID</th>
                          <th className="py-2 px-3">Amount</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {session.validation_summaries.payments.preview_rows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-950/40">
                            <td className="py-2 px-3 text-blue-400">{row.payment_id}</td>
                            <td className="py-2 px-3">{formatCurrency(row.amount)}</td>
                            <td className="py-2 px-3">{row.payment_status}</td>
                            <td className="py-2 px-3">{row.created_at || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4 Actions */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#0c121e] border border-slate-800">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Back to Validation
              </button>

              <button
                type="button"
                disabled={confirming}
                onClick={handleConfirmImport}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer"
              >
                {confirming ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{confirming ? "Reconciling Dataset..." : "Import & Auto-Reconcile Dataset"}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: COMPLETE */}
        {step === 5 && finalResult && (
          <div className="p-8 rounded-2xl bg-[#0c121e] border border-emerald-800/60 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-600 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Dataset Imported & Reconciled Successfully!
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Dataset ID: <span className="text-blue-400">{finalResult.dataset_id}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs max-w-2xl mx-auto">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Total Processed</span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {formatCurrency(finalResult.reconciliation_summary?.total_volume || 0)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Expected Net</span>
                <span className="text-sm font-bold text-blue-400 mt-0.5 block">
                  {formatCurrency(finalResult.reconciliation_summary?.expected_settlement || 0)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Exceptions</span>
                <span className="text-sm font-bold text-rose-400 mt-0.5 block">
                  {finalResult.exceptions_detected} Flagged
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Match Rate</span>
                <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                  {finalResult.reconciliation_summary?.reconciliation_rate || 0}%
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href={`/dashboard?dataset_id=${finalResult.dataset_id}`}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-lg"
              >
                <span>View Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href={`/action-center?dataset_id=${finalResult.dataset_id}`}
                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <span>Open Action Center</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  initSession();
                  setSession(null);
                  setFinalResult(null);
                }}
                className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium"
              >
                Import Another Dataset
              </button>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
