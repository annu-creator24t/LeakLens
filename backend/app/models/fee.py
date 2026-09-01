from typing import Dict, Any
from datetime import datetime
from decimal import Decimal


def fee_to_doc(dataset_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a normalized fee record into a MongoDB document."""
    return {
        "dataset_id": dataset_id,
        "fee_id": str(record.get("fee_id", "")),
        "payment_id": str(record.get("payment_id", "")),
        "fee_amount": str(record.get("fee_amount", "0.00")) if isinstance(record.get("fee_amount"), Decimal) else record.get("fee_amount", 0.0),
        "tax_amount": str(record.get("tax_amount", "0.00")) if isinstance(record.get("tax_amount"), Decimal) else record.get("tax_amount", 0.0),
        "fee_type": str(record.get("fee_type", "MDR")),
        "fee_date": record.get("fee_date", datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")),
        "ingested_at": datetime.utcnow()
    }
