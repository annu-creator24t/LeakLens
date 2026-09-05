import json
import time
import hashlib
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from app.schemas.ai import (
    AIInvestigationOutput,
    AIInvestigationRecord,
    InvestigationResponse
)
from app.services.exception_detector import exception_detector
from app.services.ai_base import get_ai_service
from app.utils.prompts import INVESTIGATION_PROMPT_VERSION
from app.db.session import db_manager


class AIInvestigatorService:
    def __init__(self):
        self._investigations_cache: Dict[str, AIInvestigationRecord] = {}

    def compute_evidence_hash(self, evidence: Dict[str, Any]) -> str:
        """
        Computes a deterministic SHA-256 hash of canonicalized structured evidence.
        Guarantees that identical financial evidence produces the same cache key.
        """
        canonical_json = json.dumps(evidence, sort_keys=True, default=str)
        return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

    async def investigate_exception(
        self,
        dataset_id: str,
        exception_id: str,
        force_refresh: bool = False
    ) -> InvestigationResponse:
        """
        Coordinates evidence loading, cache verification, LLM execution, and persistence.
        """
        # 1. Fetch Exception & Structured Evidence
        exc = await exception_detector.get_exception_detail(dataset_id, exception_id)
        if not exc:
            from app.services.reconciliation_engine import reconciliation_engine
            exc = await reconciliation_engine.get_exception_detail(dataset_id, exception_id)
        if not exc:
            raise ValueError(f"Exception '{exception_id}' not found in dataset '{dataset_id}'.")

        evidence = exc.get("evidence", {})
        exc_type = exc.get("primary_exception_type") or exc.get("exception_type", "UNKNOWN")
        severity = exc.get("severity", "HIGH")

        # 2. Compute Evidence Hash
        ev_hash = self.compute_evidence_hash(evidence)
        cache_key = f"{dataset_id}:{exception_id}"

        # 3. Check Cache / Persistence if not force_refresh
        if not force_refresh:
            cached_record = await self.get_stored_investigation(dataset_id, exception_id)
            if cached_record and cached_record.evidence_hash == ev_hash:
                return InvestigationResponse(
                    success=True,
                    exception_id=exception_id,
                    dataset_id=dataset_id,
                    cached=True,
                    investigation=cached_record.investigation,
                    metadata={
                        "investigation_id": cached_record.investigation_id,
                        "provider": cached_record.provider,
                        "model": cached_record.model,
                        "prompt_version": cached_record.prompt_version,
                        "created_at": cached_record.created_at,
                        "generation_time_ms": cached_record.generation_time_ms,
                        "evidence_hash": cached_record.evidence_hash,
                    }
                )

        # 4. Execute AI Provider
        ai_provider = get_ai_service()
        start_time = time.perf_counter()

        investigation_output = await ai_provider.investigate(
            evidence=evidence,
            exception_type=exc_type,
            severity=severity
        )

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        inv_id = f"inv_{uuid.uuid4().hex[:12]}"
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        # 5. Build Persistent Record
        record = AIInvestigationRecord(
            investigation_id=inv_id,
            dataset_id=dataset_id,
            exception_id=exception_id,
            provider=ai_provider.provider_name,
            model=ai_provider.model_name,
            prompt_version=INVESTIGATION_PROMPT_VERSION,
            created_at=now_str,
            generation_time_ms=duration_ms,
            evidence_hash=ev_hash,
            investigation=investigation_output,
        )

        # 6. Persist
        await self._persist_record(record)

        return InvestigationResponse(
            success=True,
            exception_id=exception_id,
            dataset_id=dataset_id,
            cached=False,
            investigation=investigation_output,
            metadata={
                "investigation_id": inv_id,
                "provider": ai_provider.provider_name,
                "model": ai_provider.model_name,
                "prompt_version": INVESTIGATION_PROMPT_VERSION,
                "created_at": now_str,
                "generation_time_ms": duration_ms,
                "evidence_hash": ev_hash,
            }
        )

    async def get_stored_investigation(self, dataset_id: str, exception_id: str) -> Optional[AIInvestigationRecord]:
        """Retrieves stored investigation from memory or MongoDB."""
        cache_key = f"{dataset_id}:{exception_id}"
        if cache_key in self._investigations_cache:
            return self._investigations_cache[cache_key]

        db = db_manager.get_db()
        if db is not None:
            doc = await db["ai_investigations"].find_one(
                {"dataset_id": dataset_id, "exception_id": exception_id},
                sort=[("created_at", -1)]
            )
            if doc:
                doc.pop("_id", None)
                record = AIInvestigationRecord(**doc)
                self._investigations_cache[cache_key] = record
                return record

        return None

    async def _persist_record(self, record: AIInvestigationRecord):
        cache_key = f"{record.dataset_id}:{record.exception_id}"
        self._investigations_cache[cache_key] = record

        db = db_manager.get_db()
        if db is not None:
            await db["ai_investigations"].insert_one(record.model_dump())


ai_investigator = AIInvestigatorService()
