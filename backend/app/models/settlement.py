from typing import Dict, Any
from datetime import datetime
from decimal import Decimal


def settlement_to_doc(dataset_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a normalized settlement record into a MongoDB document."""
    return {
        "dataset_id": dataset_id,
        "settlement_id": str(record["settlement_id"]),
        "payment_id": str(record["payment_id"]),
        "settlement_amount": str(record["settlement_amount"]) if isinstance(record["settlement_amount"], Decimal) else record["settlement_amount"],
        "settlement_status": str(record["settlement_status"]),
        "settlement_date": record["settlement_date"],
        "ingested_at": datetime.utcnow()
    }
