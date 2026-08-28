export type PaymentStatus = "SUCCESS" | "FAILED" | "PENDING" | "CANCELLED";
export type SettlementStatus = "SETTLED" | "PENDING" | "FAILED";
export type RefundStatus = "PROCESSED" | "PENDING" | "FAILED";

export type ExceptionType =
  | "MISSING_SETTLEMENT"
  | "AMOUNT_MISMATCH"
  | "DUPLICATE_SETTLEMENT"
  | "REFUND_MISMATCH"
  | "UNEXPECTED_FEE"
  | "DELAYED_SETTLEMENT"
  | "ORPHAN_SETTLEMENT";

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Payment {
  payment_id: string;
  order_id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_method?: string;
  created_at: string;
}

export interface Settlement {
  settlement_id: string;
  payment_id: string;
  settlement_amount: number;
  settlement_status: SettlementStatus;
  settlement_date: string;
}

export interface Refund {
  refund_id: string;
  payment_id: string;
  refund_amount: number;
  refund_status: RefundStatus;
  refund_date: string;
}

export interface Fee {
  payment_id: string;
  fee_amount: number;
  tax_amount: number;
}

export interface AIInvestigationResult {
  what_happened: string;
  why_it_matters: string;
  possible_explanation: string;
  recommended_action: string;
  confidence: number;
  generated_at?: string;
}

export interface ReconciliationException {
  exception_id: string;
  payment_id?: string;
  exception_type: ExceptionType;
  severity: SeverityLevel;
  amount_discrepancy: number;
  expected_settlement: number;
  actual_settlement: number;
  evidence: Record<string, unknown>;
  ai_investigation?: AIInvestigationResult;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  created_at: string;
}

export interface ReconciliationSummary {
  total_transactions: number;
  matched_count: number;
  exception_count: number;
  total_volume: number;
  expected_settlement: number;
  actual_settlement: number;
  unexplained_difference: number;
  reconciliation_rate: number;
}
