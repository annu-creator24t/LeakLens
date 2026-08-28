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

export async function fetchDatasetStatus(datasetId: string): Promise<DatasetUploadStatus> {
  const res = await fetch(`${API_BASE_URL}/api/upload/status?dataset_id=${encodeURIComponent(datasetId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch dataset status: ${res.status}`);
  }

  return await res.json();
}
