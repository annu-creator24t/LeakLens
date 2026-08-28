from typing import Dict, Any
from datetime import datetime
from decimal import Decimal


def payment_to_doc(dataset_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a normalized payment record into a MongoDB document."""
    return {
        "dataset_id": dataset_id,
        "payment_id": str(record["payment_id"]),
        "order_id": str(record["order_id"]),
        "merchant_id": str(record["merchant_id"]),
        "amount": str(record["amount"]) if isinstance(record["amount"], Decimal) else record["amount"],
        "currency": str(record["currency"]),
        "payment_status": str(record["payment_status"]),
        "payment_method": record.get("payment_method"),
        "created_at": record["created_at"],
        "ingested_at": datetime.utcnow()
    }
