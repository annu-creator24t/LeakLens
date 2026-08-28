from typing import Dict, Any
from datetime import datetime
from decimal import Decimal


def payment_to_doc(dataset_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a normalized payment record into a MongoDB document."""
    return {
        "dataset_id": dataset_id,
        "payment_id": str(record.get("payment_id", "")),
        "order_id": str(record.get("order_id", "")),
        "merchant_id": str(record.get("merchant_id", "MERCHANT_001")),
        "amount": str(record.get("amount", "0.00")) if isinstance(record.get("amount"), Decimal) else record.get("amount", 0.0),
        "currency": str(record.get("currency", "INR")),
        "payment_status": str(record.get("payment_status", "SUCCESS")),
        "payment_method": record.get("payment_method", "OTHER"),
        "created_at": record.get("created_at", datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")),
        "ingested_at": datetime.utcnow()
    }
