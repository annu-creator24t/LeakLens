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

export interface ReconcileResponse {
  success: boolean;
  dataset_id: string;
  total_transactions: number;
  matched_count: number;
  exception_count: number;
  total_volume: number;
  expected_settlement: number;
  actual_settlement: number;
  unexplained_difference: number;
  reconciliation_rate: number;
  duration_ms: number;
  exception_breakdown: Record<string, number>;
  severity_breakdown: Record<string, number>;
}

export interface ExceptionItem {
  exception_id: string;
  dataset_id: string;
  payment_id?: string;
  exception_type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  amount_discrepancy: number;
  expected_settlement: number;
  actual_settlement: number;
  status: string;
  description: string;
  evidence: Record<string, unknown>;
  timeline: Array<{
    step: number;
    event: string;
    timestamp: string;
    details: string;
  }>;
  created_at: string;
}

export interface ExceptionsResponse {
  dataset_id: string;
  total: number;
  page: number;
  limit: number;
  items: ExceptionItem[];
}

export async function runReconciliation(datasetId: string): Promise<ReconcileResponse> {
  const res = await fetch(`${API_BASE_URL}/api/reconciliation/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Reconciliation failed: ${res.status}`);
  }
  return await res.json();
}

export async function fetchReconciliationSummary(datasetId: string): Promise<ReconcileResponse> {
  const res = await fetch(`${API_BASE_URL}/api/reconciliation/${encodeURIComponent(datasetId)}/summary`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch summary: ${res.status}`);
  }
  return await res.json();
}

export async function fetchReconciliationExceptions(
  datasetId: string,
  params?: { severity?: string; exception_type?: string; search?: string; page?: number; limit?: number }
): Promise<ExceptionsResponse> {
  const query = new URLSearchParams();
  if (params?.severity && params.severity !== "ALL") query.append("severity", params.severity);
  if (params?.exception_type && params.exception_type !== "ALL") query.append("exception_type", params.exception_type);
  if (params?.search) query.append("search", params.search);
  if (params?.page) query.append("page", String(params.page));
  if (params?.limit) query.append("limit", String(params.limit));

  const res = await fetch(`${API_BASE_URL}/api/reconciliation/${encodeURIComponent(datasetId)}/exceptions?${query.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch exceptions: ${res.status}`);
  }
  return await res.json();
}

export async function fetchExceptionDetail(datasetId: string, exceptionId: string): Promise<ExceptionItem> {
  const res = await fetch(`${API_BASE_URL}/api/reconciliation/${encodeURIComponent(datasetId)}/exceptions/${encodeURIComponent(exceptionId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch exception detail: ${res.status}`);
  }
  return await res.json();
}

export interface MetricItem {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface EvaluationResponse {
  success: boolean;
  dataset_id: string;
  total_ground_truth: number;
  total_detected: number;
  overall: {
    total_tp: number;
    total_fp: number;
    total_fn: number;
    precision: number;
    recall: number;
    f1: number;
    macro_precision: number;
    macro_recall: number;
    macro_f1: number;
  };
  by_type: Record<string, MetricItem>;
  evaluation_time_ms: number;
}

export async function runEvaluation(datasetId: string): Promise<EvaluationResponse> {
  const res = await fetch(`${API_BASE_URL}/api/evaluation/run/${encodeURIComponent(datasetId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Evaluation failed: ${res.status}`);
  }
  return await res.json();
}

export interface DatasetItem {
  dataset_id: string;
  name: string;
  transaction_count: number;
  created_at: string;
  type: "BENCHMARK" | "UPLOADED";
}

export interface TransactionItem {
  payment_id: string;
  order_id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
  refund_amount: number;
  fee_amount: number;
  expected_settlement: number;
  actual_settlement: number;
  difference: number;
  status: string;
  has_exception: boolean;
  exception_id?: string;
}

export interface TransactionsResponse {
  dataset_id: string;
  total: number;
  page: number;
  limit: number;
  items: TransactionItem[];
}

export interface TransactionDetail {
  payment: Record<string, any>;
  settlements: Array<Record<string, any>>;
  refunds: Array<Record<string, any>>;
  fee: Record<string, any>;
  calculation: {
    payment_amount: number;
    refund_deduction: number;
    fee_deduction: number;
    tax_deduction: number;
    expected_settlement: number;
    actual_settlement: number;
    difference: number;
  };
  status: string;
  exception?: ExceptionItem;
  timeline: Array<{
    event: string;
    timestamp: string;
    details: string;
  }>;
}

export interface ExceptionSummaryResponse {
  dataset_id: string;
  total_exceptions: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  missing_settlement_count: number;
  duplicate_settlement_count: number;
  amount_mismatch_count: number;
  refund_mismatch_count: number;
  fee_anomaly_count: number;
  delayed_settlement_count: number;
  orphan_settlement_count: number;
  total_financial_impact: number;
  missing_settlement_impact: number;
  duplicate_settlement_impact: number;
  amount_mismatch_impact: number;
  refund_mismatch_impact: number;
  fee_anomaly_impact: number;
  delayed_settlement_impact: number;
  orphan_settlement_impact: number;
}

export async function fetchAvailableDatasets(): Promise<{ datasets: DatasetItem[] }> {
  const res = await fetch(`${API_BASE_URL}/api/datasets`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    return { datasets: [] };
  }
  return await res.json();
}

export async function fetchExceptionSummary(datasetId: string): Promise<ExceptionSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/api/exceptions/${encodeURIComponent(datasetId)}/summary`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch exception summary: ${res.status}`);
  }
  return await res.json();
}

export async function updateExceptionStatus(datasetId: string, exceptionId: string, status: string): Promise<{ success: boolean; status: string }> {
  const res = await fetch(`${API_BASE_URL}/api/exceptions/${encodeURIComponent(datasetId)}/${encodeURIComponent(exceptionId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update status: ${res.status}`);
  }
  return await res.json();
}

export async function fetchTransactions(
  datasetId: string,
  params?: { status?: string; search?: string; page?: number; limit?: number }
): Promise<TransactionsResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "ALL") query.append("status", params.status);
  if (params?.search) query.append("search", params.search);
  if (params?.page) query.append("page", String(params.page));
  if (params?.limit) query.append("limit", String(params.limit));

  const res = await fetch(`${API_BASE_URL}/api/transactions/${encodeURIComponent(datasetId)}?${query.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch transactions: ${res.status}`);
  }
  return await res.json();
}

export async function fetchTransactionDetail(datasetId: string, paymentId: string): Promise<TransactionDetail> {
  const res = await fetch(`${API_BASE_URL}/api/transactions/${encodeURIComponent(datasetId)}/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch transaction detail: ${res.status}`);
  }
  return await res.json();
}

export interface AIInvestigationOutput {
  summary: string;
  what_happened: string;
  why_it_matters: string;
  possible_causes: string[];
  recommended_actions: string[];
  confidence: number;
  evidence_points: string[];
  limitations: string[];
}

export interface InvestigationResponse {
  success: boolean;
  exception_id: string;
  dataset_id: string;
  cached: boolean;
  investigation: AIInvestigationOutput;
  metadata: {
    investigation_id: string;
    provider: string;
    model: string;
    prompt_version: string;
    created_at: string;
    generation_time_ms: number;
    evidence_hash: string;
  };
}

export async function triggerAIInvestigation(
  datasetId: string,
  exceptionId: string,
  forceRefresh: boolean = false
): Promise<InvestigationResponse> {
  const url = `${API_BASE_URL}/api/ai/investigate/${encodeURIComponent(datasetId)}/${encodeURIComponent(exceptionId)}${
    forceRefresh ? "?force_refresh=true" : ""
  }`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `AI Investigation failed: ${res.status}`);
  }
  return await res.json();
}

export async function fetchStoredAIInvestigation(
  datasetId: string,
  exceptionId: string
): Promise<InvestigationResponse | null> {
  const res = await fetch(
    `${API_BASE_URL}/api/ai/investigate/${encodeURIComponent(datasetId)}/${encodeURIComponent(exceptionId)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    return null;
  }
  return await res.json();
}

export interface EvidenceItem {
  label: string;
  value: string;
  link?: string;
  type: string;
}

export interface AskResponse {
  success: boolean;
  conversation_id: string;
  question: string;
  intent: string;
  answer: string;
  key_findings: string[];
  evidence: EvidenceItem[];
  related_exceptions: string[];
  limitations: string[];
  metadata: {
    dataset_id: string;
    planning_time_ms: number;
    execution_time_ms: number;
    generation_time_ms: number;
    total_time_ms: number;
    query_plan: any;
  };
}

export interface ChatMessage {
  message_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  query_plan?: any;
  evidence?: EvidenceItem[];
  created_at: string;
}

export interface ConversationHistoryResponse {
  conversation_id: string;
  dataset_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export async function askLeakLens(
  datasetId: string,
  question: string,
  conversationId?: string | null
): Promise<AskResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ask/${encodeURIComponent(datasetId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, conversation_id: conversationId || null }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Ask LeakLens failed: ${res.status}`);
  }
  return await res.json();
}

export async function fetchConversationHistory(
  datasetId: string,
  conversationId: string
): Promise<ConversationHistoryResponse | null> {
  const res = await fetch(
    `${API_BASE_URL}/api/ask/${encodeURIComponent(datasetId)}/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchAskSuggestions(datasetId: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/ask/${encodeURIComponent(datasetId)}/suggestions`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions || [];
  } catch {
    return [
      "How much money is currently unexplained?",
      "Why is today's settlement lower than expected?",
      "Show me my top 5 discrepancies.",
      "Which payments haven't settled?",
      "How many critical issues do I have?",
      "Which exception type has the highest financial impact?",
    ];
  }
}

export function getDownloadUrl(datasetId: string, fileType: string): string {
  return `${API_BASE_URL}/api/generator/${datasetId}/download/${fileType}`;
}
