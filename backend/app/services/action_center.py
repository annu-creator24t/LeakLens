import uuid
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from app.schemas.action_center import (
    InvestigationStatus,
    AuditAction,
    InvestigationNote,
    InvestigationAuditEvent,
    ActionCenterSummary,
    BulkActionRequest,
    BulkActionResponse,
    InvestigationHistoryResponse
)
from app.services.exception_detector import exception_detector
from app.db.session import db_manager

SEVERITY_WEIGHTS = {
    "CRITICAL": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
}

VALID_TRANSITIONS = {
    InvestigationStatus.OPEN: [InvestigationStatus.INVESTIGATING, InvestigationStatus.IGNORED],
    InvestigationStatus.INVESTIGATING: [InvestigationStatus.RESOLVED, InvestigationStatus.IGNORED, InvestigationStatus.OPEN],
    InvestigationStatus.RESOLVED: [InvestigationStatus.OPEN],
    InvestigationStatus.IGNORED: [InvestigationStatus.OPEN],
}


class ActionCenterService:
    def __init__(self):
        # In-memory stores
        self._notes: Dict[str, List[InvestigationNote]] = {}  # key: dataset_id:exception_id
        self._audit_events: Dict[str, List[InvestigationAuditEvent]] = {}  # key: dataset_id:exception_id

    async def get_summary(self, dataset_id: str) -> ActionCenterSummary:
        """Retrieves real-time status counts and unresolved financial impact for the dataset."""
        exceptions, _ = await exception_detector.get_exceptions(dataset_id=dataset_id, limit=100000)
        
        counts = {
            InvestigationStatus.OPEN: 0,
            InvestigationStatus.INVESTIGATING: 0,
            InvestigationStatus.RESOLVED: 0,
            InvestigationStatus.IGNORED: 0,
        }
        unresolved_impact = 0.0

        for exc in exceptions:
            st_raw = exc.get("status", "OPEN").upper()
            try:
                st = InvestigationStatus(st_raw)
            except ValueError:
                st = InvestigationStatus.OPEN
            counts[st] = counts.get(st, 0) + 1

            if st in [InvestigationStatus.OPEN, InvestigationStatus.INVESTIGATING]:
                unresolved_impact += exc.get("financial_impact", exc.get("amount_discrepancy", 0.0))

        return ActionCenterSummary(
            open=counts[InvestigationStatus.OPEN],
            investigating=counts[InvestigationStatus.INVESTIGATING],
            resolved=counts[InvestigationStatus.RESOLVED],
            ignored=counts[InvestigationStatus.IGNORED],
            total=len(exceptions),
            total_unresolved_impact=round(unresolved_impact, 2)
        )

    async def get_prioritized_exceptions(
        self,
        dataset_id: str,
        status_filter: Optional[str] = "OPEN",
        severity_filter: Optional[str] = None,
        type_filter: Optional[str] = None,
        min_impact: Optional[float] = None,
        max_impact: Optional[float] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Retrieves prioritized exceptions sorted strictly by:
        1. Severity Priority (CRITICAL > HIGH > MEDIUM > LOW)
        2. Financial Impact (Descending)
        3. Age / Creation Timestamp
        """
        exceptions, _ = await exception_detector.get_exceptions(dataset_id=dataset_id, limit=100000)
        
        filtered = []
        for exc in exceptions:
            st = exc.get("status", "OPEN").upper()
            if status_filter and status_filter != "ALL" and st != status_filter.upper():
                continue

            sev = exc.get("severity", "MEDIUM").upper()
            if severity_filter and severity_filter != "ALL" and sev != severity_filter.upper():
                continue

            etype = exc.get("primary_exception_type", exc.get("exception_type", ""))
            if type_filter and type_filter != "ALL" and etype != type_filter:
                continue

            impact = exc.get("financial_impact", exc.get("amount_discrepancy", 0.0))
            if min_impact is not None and impact < min_impact:
                continue
            if max_impact is not None and impact > max_impact:
                continue

            if search:
                q = search.strip().lower()
                pid = str(exc.get("payment_id", "")).lower()
                eid = str(exc.get("exception_id", "")).lower()
                desc = str(exc.get("description", "")).lower()
                if q not in pid and q not in eid and q not in desc:
                    continue

            filtered.append(exc)

        # Deterministic Sort
        def sort_key(e: Dict[str, Any]):
            sev = e.get("severity", "LOW").upper()
            weight = SEVERITY_WEIGHTS.get(sev, 0)
            impact = e.get("financial_impact", e.get("amount_discrepancy", 0.0))
            created = e.get("detected_at", e.get("created_at", ""))
            return (-weight, -impact, created)

        filtered.sort(key=sort_key)

        total = len(filtered)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated = filtered[start_idx:end_idx]

        return paginated, total

    async def update_status(
        self,
        dataset_id: str,
        exception_id: str,
        target_status: InvestigationStatus,
        action: AuditAction,
        note: Optional[str] = None,
        actor: str = "development-user"
    ) -> Dict[str, Any]:
        """
        Executes a validated, audited status transition.
        Guarantees idempotency and rejects illegal transitions.
        """
        exc = await exception_detector.get_exception_detail(dataset_id, exception_id)
        if not exc:
            raise ValueError(f"Exception '{exception_id}' not found in dataset '{dataset_id}'.")

        current_raw = exc.get("status", "OPEN").upper()
        try:
            current_status = InvestigationStatus(current_raw)
        except ValueError:
            current_status = InvestigationStatus.OPEN

        # Idempotent check
        if current_status == target_status:
            return exc

        # State transition validation
        allowed = VALID_TRANSITIONS.get(current_status, [])
        if target_status not in allowed:
            raise ValueError(
                f"Invalid status transition from '{current_status.value}' to '{target_status.value}'. Allowed transitions: {[s.value for s in allowed]}"
            )

        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        # 1. Update Exception Record in cache / DB
        exc["status"] = target_status.value
        exc["updated_at"] = now_str

        db = db_manager.get_db()
        if db is not None:
            await db["reconciliation_exceptions"].update_one(
                {"dataset_id": dataset_id, "exception_id": exception_id},
                {"$set": {"status": target_status.value, "updated_at": now_str}}
            )

        # 2. Record Audit Event
        audit_id = f"aud_{uuid.uuid4().hex[:12]}"
        audit_event = InvestigationAuditEvent(
            audit_id=audit_id,
            dataset_id=dataset_id,
            exception_id=exception_id,
            action=action,
            previous_status=current_status,
            new_status=target_status,
            note=note,
            actor=actor,
            created_at=now_str
        )
        await self._persist_audit_event(audit_event)

        # 3. If note provided, save note
        if note:
            note_id = f"not_{uuid.uuid4().hex[:12]}"
            inv_note = InvestigationNote(
                note_id=note_id,
                dataset_id=dataset_id,
                exception_id=exception_id,
                note=note,
                actor=actor,
                created_at=now_str
            )
            await self._persist_note(inv_note)

        return exc

    async def add_note(
        self,
        dataset_id: str,
        exception_id: str,
        note_text: str,
        actor: str = "development-user"
    ) -> InvestigationNote:
        """Adds an investigation note without modifying status."""
        exc = await exception_detector.get_exception_detail(dataset_id, exception_id)
        if not exc:
            raise ValueError(f"Exception '{exception_id}' not found in dataset '{dataset_id}'.")

        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        note_id = f"not_{uuid.uuid4().hex[:12]}"
        
        inv_note = InvestigationNote(
            note_id=note_id,
            dataset_id=dataset_id,
            exception_id=exception_id,
            note=note_text.strip(),
            actor=actor,
            created_at=now_str
        )
        await self._persist_note(inv_note)

        # Audit Event for note added
        audit_event = InvestigationAuditEvent(
            audit_id=f"aud_{uuid.uuid4().hex[:12]}",
            dataset_id=dataset_id,
            exception_id=exception_id,
            action=AuditAction.NOTE_ADDED,
            previous_status=InvestigationStatus(exc.get("status", "OPEN")),
            new_status=InvestigationStatus(exc.get("status", "OPEN")),
            note=note_text.strip(),
            actor=actor,
            created_at=now_str
        )
        await self._persist_audit_event(audit_event)

        return inv_note

    async def get_history(self, dataset_id: str, exception_id: str) -> InvestigationHistoryResponse:
        """Retrieves chronological notes and audit history for the exception."""
        exc = await exception_detector.get_exception_detail(dataset_id, exception_id)
        if not exc:
            raise ValueError(f"Exception '{exception_id}' not found in dataset '{dataset_id}'.")

        key = f"{dataset_id}:{exception_id}"
        notes = list(self._notes.get(key, []))
        audits = list(self._audit_events.get(key, []))

        # Query MongoDB if memory is empty
        db = db_manager.get_db()
        if db is not None:
            if not notes:
                c_notes = db["investigation_notes"].find({"dataset_id": dataset_id, "exception_id": exception_id}, {"_id": 0}).sort("created_at", -1)
                docs = await c_notes.to_list(length=None)
                notes = [InvestigationNote(**d) for d in docs]
                self._notes[key] = notes

            if not audits:
                c_audits = db["investigation_audit_events"].find({"dataset_id": dataset_id, "exception_id": exception_id}, {"_id": 0}).sort("created_at", 1)
                a_docs = await c_audits.to_list(length=None)
                audits = [InvestigationAuditEvent(**d) for d in a_docs]
                self._audit_events[key] = audits

        # Sort notes newest first
        notes.sort(key=lambda n: n.created_at, reverse=True)
        # Sort audit events chronological
        audits.sort(key=lambda a: a.created_at)

        return InvestigationHistoryResponse(
            exception_id=exception_id,
            dataset_id=dataset_id,
            current_status=InvestigationStatus(exc.get("status", "OPEN")),
            notes=notes,
            audit_events=audits
        )

    async def execute_bulk_action(
        self,
        dataset_id: str,
        request: BulkActionRequest
    ) -> BulkActionResponse:
        """Executes safe bulk operations with per-item validation and failure reporting."""
        act_upper = request.action.upper()
        if act_upper == "START":
            target_status = InvestigationStatus.INVESTIGATING
            audit_action = AuditAction.INVESTIGATION_STARTED
        elif act_upper == "IGNORE":
            target_status = InvestigationStatus.IGNORED
            audit_action = AuditAction.IGNORED
        else:
            raise ValueError(f"Unsupported bulk action '{request.action}'. Only 'START' and 'IGNORE' are allowed.")

        updated_ids: List[str] = []
        skipped_reasons: Dict[str, str] = {}

        for eid in request.exception_ids:
            try:
                await self.update_status(
                    dataset_id=dataset_id,
                    exception_id=eid,
                    target_status=target_status,
                    action=audit_action,
                    note=request.note,
                    actor=request.actor
                )
                updated_ids.append(eid)
            except Exception as e:
                skipped_reasons[eid] = str(e)

        return BulkActionResponse(
            success=True,
            total_requested=len(request.exception_ids),
            updated_count=len(updated_ids),
            skipped_count=len(skipped_reasons),
            updated_ids=updated_ids,
            skipped_reasons=skipped_reasons
        )

    async def _persist_note(self, note: InvestigationNote):
        key = f"{note.dataset_id}:{note.exception_id}"
        self._notes.setdefault(key, []).append(note)
        db = db_manager.get_db()
        if db is not None:
            await db["investigation_notes"].insert_one(note.model_dump())

    async def _persist_audit_event(self, event: InvestigationAuditEvent):
        key = f"{event.dataset_id}:{event.exception_id}"
        self._audit_events.setdefault(key, []).append(event)
        db = db_manager.get_db()
        if db is not None:
            await db["investigation_audit_events"].insert_one(event.model_dump())


action_center_service = ActionCenterService()
