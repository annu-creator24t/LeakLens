from typing import Set

# Maximum allowable upload size (15 MB per file for standard CSVs)
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024

ALLOWED_FILE_EXTENSIONS: Set[str] = {".csv"}

# Allowed statuses
ALLOWED_PAYMENT_STATUSES: Set[str] = {"SUCCESS", "FAILED", "PENDING", "CANCELLED", "CAPTURED"}
ALLOWED_SETTLEMENT_STATUSES: Set[str] = {"SETTLED", "PENDING", "FAILED"}
ALLOWED_REFUND_STATUSES: Set[str] = {"PROCESSED", "PENDING", "FAILED", "REFUNDED"}

# Supported currencies
ALLOWED_CURRENCIES: Set[str] = {"INR", "USD", "EUR", "GBP", "SGD", "AED"}

# Column schema definitions
SCHEMA_COLUMNS = {
    "payments": [
        "payment_id",
        "order_id",
        "merchant_id",
        "amount",
        "currency",
        "payment_status",
        "payment_method",
        "created_at",
    ],
    "settlements": [
        "settlement_id",
        "payment_id",
        "settlement_amount",
        "settlement_status",
        "settlement_date",
    ],
    "refunds": [
        "refund_id",
        "payment_id",
        "refund_amount",
        "refund_status",
        "refund_date",
    ],
    "fees": [
        "payment_id",
        "fee_amount",
        "tax_amount",
    ],
}

PRIMARY_KEYS = {
    "payments": "payment_id",
    "settlements": "settlement_id",
    "refunds": "refund_id",
    "fees": "payment_id",
}
