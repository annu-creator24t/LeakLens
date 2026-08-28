const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ValidationErrorItem {
  row: number;
  field?: string;
  code: string;
  message: string;
  raw_value?: string;
}

export interface ValidationSummary {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
}

export interface UploadResponse {
  success: boolean;
  file_type: "payments" | "settlements" | "refunds" | "fees";
  dataset_id: string;
  summary: ValidationSummary;
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
}

export interface DatasetUploadStatus {
  dataset_id: string;
  created_at: string;
  updated_at: string;
  uploaded_files: string[];
  file_summaries: Record<string, ValidationSummary>;
  status: string;
}

export async function checkBackendHealth(): Promise<{ status: string; service: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    return {
      status: "unavailable",
      service: `leaklens-backend (${error instanceof Error ? error.message : "Connection failed"})`,
    };
  }
}

export async function uploadFinancialFile(
  fileType: "payments" | "settlements" | "refunds" | "fees",
  file: File,
  datasetId?: string
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (datasetId) {
    formData.append("dataset_id", datasetId);
  }

  const res = await fetch(`${API_BASE_URL}/api/upload/${fileType}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed with status code ${res.status}`);
  }

  return await res.json();
}

export interface GeneratorConfig {
  transaction_count: number;
  anomaly_rate: number;
  seed: number;
  merchant_id?: string;
  anomalies: {
    missing_settlement: boolean;
    duplicate_settlement: boolean;
    amount_mismatch: boolean;
    refund_mismatch: boolean;
    fee_anomaly: boolean;
    delayed_settlement: boolean;
    orphan_settlement: boolean;
  };
}

export interface GeneratorResponse {
  success: boolean;
  dataset_id: string;
  transaction_count: number;
  anomaly_count: number;
  generation_time_ms: number;
  anomaly_breakdown: Record<string, number>;
  files_available: string[];
}

export async function generateSyntheticDataset(config: GeneratorConfig): Promise<GeneratorResponse> {
  const res = await fetch(`${API_BASE_URL}/api/generator/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Generation failed with status ${res.status}`);
  }

  return await res.json();
}

export function getDownloadUrl(datasetId: string, fileType: string): string {
  return `${API_BASE_URL}/api/generator/${datasetId}/download/${fileType}`;
}
