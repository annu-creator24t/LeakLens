from typing import Dict, Any
from datetime import datetime
from decimal import Decimal


def refund_to_doc(dataset_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a normalized refund record into a MongoDB document."""
    return {
        "dataset_id": dataset_id,
        "refund_id": str(record.get("refund_id", "")),
        "payment_id": str(record.get("payment_id", "")),
        "refund_amount": str(record.get("refund_amount", "0.00")) if isinstance(record.get("refund_amount"), Decimal) else record.get("refund_amount", 0.0),
        "refund_status": str(record.get("refund_status", "PROCESSED")),
        "refund_date": record.get("refund_date", datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")),
        "ingested_at": datetime.utcnow()
    }
