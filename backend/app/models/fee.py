from typing import Dict, Any
from datetime import datetime
from decimal import Decimal


def fee_to_doc(dataset_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a normalized fee record into a MongoDB document."""
    return {
        "dataset_id": dataset_id,
        "payment_id": str(record["payment_id"]),
        "fee_amount": str(record["fee_amount"]) if isinstance(record["fee_amount"], Decimal) else record["fee_amount"],
        "tax_amount": str(record["tax_amount"]) if isinstance(record["tax_amount"], Decimal) else record["tax_amount"],
        "ingested_at": datetime.utcnow()
    }
