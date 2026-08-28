from typing import Dict, Any
from datetime import datetime
from decimal import Decimal


def settlement_to_doc(dataset_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a normalized settlement record into a MongoDB document."""
    return {
        "dataset_id": dataset_id,
        "settlement_id": str(record.get("settlement_id", "")),
        "payment_id": str(record.get("payment_id", "")),
        "settlement_amount": str(record.get("settlement_amount", "0.00")) if isinstance(record.get("settlement_amount"), Decimal) else record.get("settlement_amount", 0.0),
        "settlement_status": str(record.get("settlement_status", "SETTLED")),
        "settlement_date": record.get("settlement_date", datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")),
        "ingested_at": datetime.utcnow()
    }
