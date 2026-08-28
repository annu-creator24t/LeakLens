import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.db.session import db_manager
from app.models.dataset import create_dataset_document
from app.models.payment import payment_to_doc
from app.models.settlement import settlement_to_doc
from app.models.refund import refund_to_doc
from app.models.fee import fee_to_doc


class DatasetService:
    def __init__(self):
        # In-memory storage fallback for local development or testing when MongoDB is offline
        self._memory_sessions: Dict[str, Dict[str, Any]] = {}
        self._memory_records: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}

    def generate_dataset_id(self) -> str:
        """Generates a unique dataset session identifier."""
        return f"ds_{uuid.uuid4().hex[:12]}"

    async def get_or_create_session(self, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Retrieves an existing session or initializes a new one."""
        if not dataset_id:
            dataset_id = self.generate_dataset_id()

        db = db_manager.get_db()
        if db is not None:
            existing = await db["dataset_sessions"].find_one({"dataset_id": dataset_id})
            if existing:
                return existing
            new_session = create_dataset_document(dataset_id)
            await db["dataset_sessions"].insert_one(new_session)
            return new_session
        else:
            if dataset_id not in self._memory_sessions:
                self._memory_sessions[dataset_id] = create_dataset_document(dataset_id)
                self._memory_records[dataset_id] = {
                    "payments": [],
                    "settlements": [],
                    "refunds": [],
                    "fees": [],
                }
            return self._memory_sessions[dataset_id]

    async def store_records(
        self,
        dataset_id: str,
        file_type: str,
        records: List[Dict[str, Any]],
        summary: Dict[str, Any]
    ):
        """Stores normalized records and updates the dataset session summary."""
        db = db_manager.get_db()

        # Convert records to appropriate document format
        doc_mappers = {
            "payments": payment_to_doc,
            "settlements": settlement_to_doc,
            "refunds": refund_to_doc,
            "fees": fee_to_doc,
        }
        mapper = doc_mappers[file_type]
        docs = [mapper(dataset_id, r) for r in records]

        if db is not None:
            collection_name = file_type
            if docs:
                # Delete prior records for this file_type in this dataset_id before replacing
                await db[collection_name].delete_many({"dataset_id": dataset_id})
                await db[collection_name].insert_many(docs)

            # Update dataset session
            await db["dataset_sessions"].update_one(
                {"dataset_id": dataset_id},
                {
                    "$addToSet": {"uploaded_files": file_type},
                    "$set": {
                        f"file_summaries.{file_type}": summary,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        else:
            # In-memory update
            if dataset_id not in self._memory_records:
                self._memory_records[dataset_id] = {"payments": [], "settlements": [], "refunds": [], "fees": []}
            self._memory_records[dataset_id][file_type] = docs

            session = self._memory_sessions.get(dataset_id)
            if session:
                if file_type not in session["uploaded_files"]:
                    session["uploaded_files"].append(file_type)
                session["file_summaries"][file_type] = summary
                session["updated_at"] = datetime.utcnow()

    async def get_session_status(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves dataset session progress and file summaries."""
        db = db_manager.get_db()
        if db is not None:
            session = await db["dataset_sessions"].find_one({"dataset_id": dataset_id}, {"_id": 0})
            return session
        else:
            return self._memory_sessions.get(dataset_id)

    async def get_records(self, dataset_id: str, file_type: str) -> List[Dict[str, Any]]:
        """Fetches stored records for a specific file type and dataset session."""
        db = db_manager.get_db()
        if db is not None:
            cursor = db[file_type].find({"dataset_id": dataset_id}, {"_id": 0})
            return await cursor.to_list(length=None)
        else:
            return self._memory_records.get(dataset_id, {}).get(file_type, [])


dataset_service = DatasetService()
