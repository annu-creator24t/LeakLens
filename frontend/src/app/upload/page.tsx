"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Trash2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Info,
  Database,
  FileSpreadsheet,
} from "lucide-react";
import { uploadFinancialFile, UploadResponse, ValidationErrorItem } from "@/lib/api";

type FileType = "payments" | "settlements" | "refunds" | "fees";

interface FileCardState {
  fileType: FileType;
  title: string;
  filename: string;
  description: string;
  requiredColumns: string[];
  file: File | null;
  uploading: boolean;
  validated: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
}

const INITIAL_CARDS: Record<FileType, FileCardState> = {
  payments: {
    fileType: "payments",
    title: "1. Payments",
    filename: "payments.csv",
    description: "Captured customer transactions, amounts, and payment methods.",
    requiredColumns: ["payment_id", "order_id", "merchant_id", "amount", "currency", "payment_status", "payment_method", "created_at"],
    file: null,
    uploading: false,
    validated: false,
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    errors: [],
    warnings: [],
  },
  settlements: {
    fileType: "settlements",
    title: "2. Settlements",
    filename: "settlements.csv",
    description: "Bank settlement payouts credited by payment gateway.",
    requiredColumns: ["settlement_id", "payment_id", "settlement_amount", "settlement_status", "settlement_date"],
    file: null,
    uploading: false,
    validated: false,
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    errors: [],
    warnings: [],
  },
  refunds: {
    fileType: "refunds",
    title: "3. Refunds",
    filename: "refunds.csv",
    description: "Customer refund adjustments and return deductions.",
    requiredColumns: ["refund_id", "payment_id", "refund_amount", "refund_status", "refund_date"],
    file: null,
    uploading: false,
    validated: false,
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    errors: [],
    warnings: [],
  },
  fees: {
    fileType: "fees",
    title: "4. Fees & Taxes",
    filename: "fees.csv",
    description: "MDR processing fee deductions and applicable GST.",
    requiredColumns: ["payment_id", "fee_amount", "tax_amount"],
    file: null,
    uploading: false,
    validated: false,
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    errors: [],
    warnings: [],
  },
};

export default function UploadPage() {
  const router = useRouter();
  const [cards, setCards] = useState<Record<FileType, FileCardState>>(INITIAL_CARDS);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Record<FileType, boolean>>({
    payments: false,
    settlements: false,
    refunds: false,
    fees: false,
  });

  const handleFileUpload = async (fileType: FileType, file: File) => {
    // Set uploading state
    setCards((prev) => ({
      ...prev,
      [fileType]: {
        ...prev[fileType],
        file,
        uploading: true,
        errors: [],
        warnings: [],
      },
    }));

    try {
      const response: UploadResponse = await uploadFinancialFile(
        fileType,
        file,
        activeDatasetId || undefined
      );

      // Save dataset_id session
      if (response.dataset_id && !activeDatasetId) {
        setActiveDatasetId(response.dataset_id);
      }

      setCards((prev) => ({
        ...prev,
        [fileType]: {
          ...prev[fileType],
          uploading: false,
          validated: response.success,
          totalRows: response.summary.total_rows,
          validRows: response.summary.valid_rows,
          invalidRows: response.summary.invalid_rows,
          errors: response.errors,
          warnings: response.warnings,
        },
      }));

      if (!response.success && response.errors.length > 0) {
        setExpandedErrors((prev) => ({ ...prev, [fileType]: true }));
      }
    } catch (err) {
      setCards((prev) => ({
        ...prev,
        [fileType]: {
          ...prev[fileType],
          uploading: false,
          validated: false,
          errors: [
            {
              row: 1,
              code: "UPLOAD_FAILED",
              message: err instanceof Error ? err.message : "Network error during upload.",
            },
          ],
        },
      }));
      setExpandedErrors((prev) => ({ ...prev, [fileType]: true }));
    }
  };

  const handleFileChange = (fileType: FileType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(fileType, file);
    }
  };

  const handleDrop = (fileType: FileType, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(fileType, file);
    }
  };

  const handleResetCard = (fileType: FileType) => {
    setCards((prev) => ({
      ...prev,
      [fileType]: INITIAL_CARDS[fileType],
    }));
  };

  const validatedCount = Object.values(cards).filter((c) => c.validated).length;

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col justify-between fintech-grid">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#080b11]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-white tracking-tight">LEAKLENS</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-300 text-sm font-medium">Dataset Ingestion & Validation</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {activeDatasetId && (
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/50 text-blue-400 text-xs font-mono">
                <Database className="w-3.5 h-3.5" />
                <span>Session: {activeDatasetId}</span>
              </div>
            )}
            <div className="text-xs text-slate-400 font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
              Phase 2 Active
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 flex-1 w-full space-y-8">
        
        {/* Page Hero Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/70">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
              <span>Upload Financial Records</span>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Upload the 4 merchant settlement CSVs. Every record will be validated against strict schemas and normalized into decimal precision.
            </p>
          </div>

          {/* Quick Info Badge */}
          <div className="flex items-center space-x-2 text-xs bg-slate-900/90 border border-slate-800 px-3.5 py-2 rounded-lg text-slate-400">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>Strict zero-float decimal precision & column validation active.</span>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {(Object.keys(cards) as FileType[]).map((key) => {
            const card = cards[key];
            const hasErrors = card.errors.length > 0;

            return (
              <div
                key={key}
                className={`rounded-xl border transition-all duration-200 bg-[#0c121e] flex flex-col justify-between ${
                  card.validated
                    ? "border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
                    : hasErrors
                    ? "border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.08)]"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Card Top Header */}
                <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                        card.validated
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                          : hasErrors
                          ? "bg-rose-950/60 text-rose-400 border border-rose-800/60"
                          : "bg-slate-900 text-slate-400 border border-slate-800"
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white tracking-tight">{card.title}</h2>
                      <span className="text-[11px] text-slate-400 font-mono">{card.filename}</span>
                    </div>
                  </div>

                  {/* Status Pill */}
                  {card.uploading && (
                    <span className="flex items-center space-x-1.5 text-xs text-blue-400 font-mono px-2.5 py-1 rounded bg-blue-950/50 border border-blue-900/50 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Validating...</span>
                    </span>
                  )}
                  {card.validated && (
                    <span className="flex items-center space-x-1.5 text-xs text-emerald-400 font-mono px-2.5 py-1 rounded bg-emerald-950/50 border border-emerald-900/50">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Validated</span>
                    </span>
                  )}
                  {hasErrors && !card.uploading && (
                    <span className="flex items-center space-x-1.5 text-xs text-rose-400 font-mono px-2.5 py-1 rounded bg-rose-950/50 border border-rose-900/50">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Validation Error</span>
                    </span>
                  )}
                  {!card.file && !card.uploading && (
                    <span className="text-xs text-slate-500 font-mono px-2 py-0.5 rounded bg-slate-900">
                      Pending
                    </span>
                  )}
                </div>

                {/* Card Body / Drag & Drop Area */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <p className="text-xs text-slate-400">{card.description}</p>

                  {!card.file ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(key, e)}
                      className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/30 group"
                      onClick={() => document.getElementById(`file-input-${key}`)?.click()}
                    >
                      <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-blue-400 transition-colors mb-2" />
                      <p className="text-xs font-medium text-slate-300">
                        Drag and drop <span className="font-mono text-blue-400">{card.filename}</span> here
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">or click to browse from device</p>
                      <input
                        id={`file-input-${key}`}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => handleFileChange(key, e)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Uploaded File Info Bar */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                        <div className="flex items-center space-x-2 truncate">
                          <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <span className="font-mono text-slate-200 truncate">{card.file.name}</span>
                          <span className="text-slate-500 text-[11px]">
                            ({(card.file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleResetCard(key)}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Validation Stats */}
                      {card.validated && (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 rounded bg-slate-900/50 border border-slate-800/80">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Total Rows</span>
                            <p className="font-bold font-mono text-slate-200">{card.totalRows.toLocaleString()}</p>
                          </div>
                          <div className="p-2 rounded bg-emerald-950/20 border border-emerald-900/30">
                            <span className="text-[10px] text-emerald-500 uppercase font-mono">Valid</span>
                            <p className="font-bold font-mono text-emerald-400">{card.validRows.toLocaleString()}</p>
                          </div>
                          <div className="p-2 rounded bg-slate-900/50 border border-slate-800/80">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Invalid</span>
                            <p className="font-bold font-mono text-slate-400">{card.invalidRows}</p>
                          </div>
                        </div>
                      )}

                      {/* Errors Panel */}
                      {hasErrors && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-rose-400">
                            <span className="font-semibold flex items-center space-x-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{card.errors.length} validation issue(s) detected</span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedErrors((prev) => ({ ...prev, [key]: !prev[key] }))
                              }
                              className="text-[11px] underline hover:text-rose-300"
                            >
                              {expandedErrors[key] ? "Hide details" : "View details"}
                            </button>
                          </div>

                          {expandedErrors[key] && (
                            <div className="max-h-36 overflow-y-auto space-y-1.5 p-3 rounded-lg bg-rose-950/30 border border-rose-900/40 text-xs font-mono">
                              {card.errors.map((err, idx) => (
                                <div key={idx} className="text-rose-300 text-[11px] leading-relaxed border-b border-rose-900/30 pb-1 last:border-b-0">
                                  <strong className="text-rose-200">Row {err.row}</strong> [{err.code}]: {err.message}
                                  {err.raw_value && <span className="text-slate-400"> (value: &quot;{err.raw_value}&quot;)</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Schema Requirements Pill */}
                  <div className="pt-2 border-t border-slate-800/60">
                    <p className="text-[10px] text-slate-500 font-mono">
                      Required cols: {card.requiredColumns.join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Action & Progress Bar */}
        <div className="p-6 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold font-mono text-sm">
              {validatedCount}/4
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {validatedCount === 4
                  ? "All 4 Financial Datasets Validated"
                  : `${validatedCount} of 4 Datasets Uploaded & Validated`}
              </h3>
              <p className="text-xs text-slate-400">
                {validatedCount === 4
                  ? "Your session dataset is isolated and normalized in storage. Ready for Phase 3/4."
                  : "Upload all 4 CSVs to unlock the complete end-to-end reconciliation flow."}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              disabled={validatedCount === 0}
              onClick={() => router.push(`/reconciliation?dataset_id=${activeDatasetId || ""}`)}
              className={`px-6 py-3 rounded-lg font-medium text-sm flex items-center space-x-2 transition-all ${
                validatedCount > 0
                  ? "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }`}
            >
              <span>Continue to Reconciliation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© 2026 LeakLens. Razorpay AI Buildathon — Track 04: AI Finance Controller. Phase 2 Ingestion.</p>
      </footer>
    </div>
  );
}
