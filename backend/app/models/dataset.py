from datetime import datetime
from typing import Dict, Any, List


def create_dataset_document(
    dataset_id: str,
    merchant_id: str = "merchant_default"
) -> Dict[str, Any]:
    """Builds a MongoDB document dictionary for a dataset session."""
    now = datetime.utcnow()
    return {
        "dataset_id": dataset_id,
        "merchant_id": merchant_id,
        "created_at": now,
        "updated_at": now,
        "uploaded_files": [],
        "file_summaries": {},
        "status": "IN_PROGRESS"
    }
