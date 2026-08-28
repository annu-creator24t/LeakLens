from typing import Dict, Any
from datetime import datetime
from decimal import Decimal


def refund_to_doc(dataset_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a normalized refund record into a MongoDB document."""
    return {
        "dataset_id": dataset_id,
        "refund_id": str(record["refund_id"]),
        "payment_id": str(record["payment_id"]),
        "refund_amount": str(record["refund_amount"]) if isinstance(record["refund_amount"], Decimal) else record["refund_amount"],
        "refund_status": str(record["refund_status"]),
        "refund_date": record["refund_date"],
        "ingested_at": datetime.utcnow()
    }
