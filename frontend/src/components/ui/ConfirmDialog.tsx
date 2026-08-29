"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger" | "success";
  requireNote?: boolean;
  notePlaceholder?: string;
  loading?: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm Action",
  cancelLabel = "Cancel",
  variant = "primary",
  requireNote = true,
  notePlaceholder = "Provide a mandatory resolution note for the audit ledger...",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setNote("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireNote && !note.trim()) {
      setError("Resolution note is required for the audit trail.");
      return;
    }
    setError("");
    onConfirm(note.trim());
  };

  const confirmBtnStyles = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white",
    danger: "bg-rose-600 hover:bg-rose-500 text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white",
  }[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-[#0c121e] shadow-2xl p-6 space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400">
              {variant === "danger" ? (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              ) : variant === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Note Input */}
        {requireNote && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 block">
              Resolution Note <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError("");
              }}
              placeholder={notePlaceholder}
              className="w-full p-3 rounded-lg bg-slate-950/80 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-100 placeholder:text-slate-500 transition-colors outline-none resize-none"
            />
            {error && <p className="text-[11px] text-rose-400">{error}</p>}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={loading || (requireNote && !note.trim())}
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer ${confirmBtnStyles}`}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>

      </div>
    </div>
  );
}

export default ConfirmDialog;
