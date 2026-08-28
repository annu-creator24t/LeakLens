import io
import re
import os
import csv
import uuid
import time
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, Any, List, Tuple, Optional

from app.schemas.upload_pipeline import (
    DatasetStatus,
    IssueSeverity,
    ColumnMappingItem,
    FileUploadInfo,
    ValidationIssue,
    FileValidationSummary,
    UploadSessionState,
    StartUploadResponse,
    ConfirmDatasetRequest,
    ConfirmDatasetResponse,
    DatasetListItem,
)
from app.utils.money import to_decimal
from app.services.dataset_service import dataset_service
from app.services.reconciliation_engine import reconciliation_engine
from app.services.exception_detector import exception_detector
from app.db.session import db_manager

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB
MAX_TOTAL_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB

REQUIRED_FIELDS = {
    "payments": ["payment_id", "amount", "payment_status"],
    "settlements": ["settlement_id", "payment_id", "settlement_amount", "settlement_status", "settlement_date"],
    "refunds": ["refund_id", "payment_id", "refund_amount", "refund_status", "refund_date"],
    "fees": ["payment_id", "fee_amount"],
}

COLUMN_VARIATIONS = {
    "payments": {
        "payment_id": ["payment_id", "id", "transaction_id", "txn_id", "payment_reference", "reference_id"],
        "order_id": ["order_id", "order", "merchant_order_id", "order_ref", "order_number"],
        "merchant_id": ["merchant_id", "merchant", "mid", "seller_id"],
        "amount": ["amount", "payment_amount", "transaction_amount", "gross_amount", "paid_amount", "total"],
        "currency": ["currency", "curr", "curr_code"],
        "payment_status": ["payment_status", "status", "transaction_status", "txn_status", "state"],
        "payment_method": ["payment_method", "method", "payment_type", "type", "channel", "mode"],
        "created_at": ["created_at", "payment_date", "transaction_date", "date", "timestamp", "created_date"],
    },
    "settlements": {
        "settlement_id": ["settlement_id", "id", "payout_id", "batch_id", "settlement_ref", "settle_id"],
        "payment_id": ["payment_id", "txn_id", "transaction_id", "reference_id"],
        "settlement_amount": ["settlement_amount", "amount", "payout_amount", "net_amount", "credit_amount"],
        "settlement_status": ["settlement_status", "status", "payout_status", "state"],
        "settlement_date": ["settlement_date", "date", "payout_date", "settled_at", "settlement_time"],
    },
    "refunds": {
        "refund_id": ["refund_id", "id", "refund_ref", "credit_note_id", "refund_reference"],
        "payment_id": ["payment_id", "txn_id", "transaction_id", "reference_id"],
        "refund_amount": ["refund_amount", "amount", "refunded_amount", "credit_amount"],
        "refund_status": ["refund_status", "status", "state"],
        "refund_date": ["refund_date", "date", "refunded_at", "refund_time"],
    },
    "fees": {
        "payment_id": ["payment_id", "txn_id", "transaction_id", "reference_id"],
        "fee_amount": ["fee_amount", "fee", "mdr", "fee_deducted", "charge", "processing_fee"],
        "tax_amount": ["tax_amount", "tax", "gst", "vat", "service_tax"],
    }
}


def sanitize_filename(filename: str) -> str:
    """Strips path traversal sequences, null bytes, and unsafe characters."""
    base = os.path.basename(filename)
    clean = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", base)
    return clean or "uploaded_file.csv"


class UploadPipelineService:
    def __init__(self):
        self._sessions: Dict[str, UploadSessionState] = {}
        self._raw_file_contents: Dict[str, Dict[str, bytes]] = {}  # upload_id -> {file_type: bytes}
        self._parsed_rows_cache: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}  # upload_id -> {file_type: rows}
        self._datasets_in_memory: Dict[str, Dict[str, Any]] = {}  # dataset_id -> metadata dict

    def start_session(self) -> StartUploadResponse:
        """Initializes a new isolated upload session."""
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        upload_id = f"upl_{datetime.utcnow().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"
        
        session = UploadSessionState(
            upload_id=upload_id,
            status=DatasetStatus.UPLOADING,
            files={},
            validation_summaries={},
            issues=[],
            created_at=now_str,
            updated_at=now_str,
            is_ready_to_confirm=False
        )
        self._sessions[upload_id] = session
        self._raw_file_contents[upload_id] = {}
        self._parsed_rows_cache[upload_id] = {}

        return StartUploadResponse(
            success=True,
            upload_id=upload_id,
            status=DatasetStatus.UPLOADING,
            created_at=now_str
        )

    def get_session(self, upload_id: str) -> Optional[UploadSessionState]:
        return self._sessions.get(upload_id)

    async def ingest_file(
        self,
        upload_id: str,
        file_type: str,
        original_filename: str,
        file_bytes: bytes
    ) -> FileUploadInfo:
        """Validates file constraints, parses headers, and performs schema auto-detection."""
        session = self._sessions.get(upload_id)
        if not session:
            raise ValueError(f"Upload session '{upload_id}' not found or expired.")

        clean_name = sanitize_filename(original_filename)
        file_type = file_type.lower().strip()
        if file_type not in ["payments", "settlements", "refunds", "fees"]:
            raise ValueError(f"Invalid file type '{file_type}'. Supported: payments, settlements, refunds, fees.")

        # 1. Size Constraints
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise ValueError(f"File '{clean_name}' exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.")

        current_total = sum(len(b) for b in self._raw_file_contents.get(upload_id, {}).values())
        if current_total + len(file_bytes) > MAX_TOTAL_UPLOAD_BYTES:
            raise ValueError(f"Combined upload exceeds maximum limit of {MAX_TOTAL_UPLOAD_BYTES // (1024 * 1024)} MB.")

        # 2. Decode & Parse CSV
        try:
            text = file_bytes.decode("utf-8-sig")  # Handles standard UTF-8 and BOM
        except UnicodeDecodeError:
            try:
                text = file_bytes.decode("latin-1")
            except Exception:
                raise ValueError(f"File '{clean_name}' could not be decoded as UTF-8 or Latin-1.")

        if not text.strip():
            raise ValueError(f"File '{clean_name}' is empty.")

        f_io = io.StringIO(text)
        reader = csv.reader(f_io)
        try:
            headers = next(reader, None)
        except Exception as e:
            raise ValueError(f"Malformed CSV header in '{clean_name}': {str(e)}")

        if not headers or all(not h.strip() for h in headers):
            raise ValueError(f"File '{clean_name}' has missing or empty header columns.")

        cleaned_headers = [h.strip() for h in headers if h.strip()]

        # 3. Detect Schema & Column Mappings
        mappings = self._detect_mappings(file_type, cleaned_headers)

        # Count total rows
        row_count = sum(1 for row in reader if any(cell.strip() for cell in row))

        info = FileUploadInfo(
            file_type=file_type,
            original_filename=clean_name,
            file_size_bytes=len(file_bytes),
            row_count=row_count,
            headers=cleaned_headers,
            column_mappings=mappings,
            uploaded_at=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            is_valid=False
        )

        session.files[file_type] = info
        session.updated_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        self._raw_file_contents[upload_id][file_type] = file_bytes

        return info

    def _detect_mappings(self, file_type: str, headers: List[str]) -> List[ColumnMappingItem]:
        """Matches source columns against canonical targets with confidence scores."""
        target_dict = COLUMN_VARIATIONS.get(file_type, {})
        req_list = REQUIRED_FIELDS.get(file_type, [])
        items: List[ColumnMappingItem] = []

        used_targets = set()

        for col in headers:
            col_clean = re.sub(r"[^a-zA-Z0-9_]", "", col.lower().replace(" ", "_"))
            matched_target = None
            best_conf = 0.0

            for target_field, synonyms in target_dict.items():
                if target_field in used_targets:
                    continue

                if col_clean == target_field:
                    matched_target = target_field
                    best_conf = 1.0
                    break
                elif col_clean in synonyms:
                    matched_target = target_field
                    best_conf = 0.95
                    break
                elif any(s in col_clean for s in synonyms):
                    matched_target = target_field
                    best_conf = 0.75

            if matched_target:
                used_targets.add(matched_target)
                is_req = matched_target in req_list
                items.append(ColumnMappingItem(
                    source_column=col,
                    target_field=matched_target,
                    confidence=best_conf,
                    is_required=is_req,
                    is_mapped=True,
                    alternatives=[k for k in target_dict.keys() if k != matched_target]
                ))
            else:
                items.append(ColumnMappingItem(
                    source_column=col,
                    target_field="",
                    confidence=0.0,
                    is_required=False,
                    is_mapped=False,
                    alternatives=list(target_dict.keys())
                ))

        return items

    def update_mappings(self, upload_id: str, file_type: str, new_mappings: Dict[str, str]):
        """Manually sets user-selected column mappings."""
        session = self._sessions.get(upload_id)
        if not session or file_type not in session.files:
            raise ValueError(f"File '{file_type}' not found in upload session.")

        file_info = session.files[file_type]
        req_list = REQUIRED_FIELDS.get(file_type, [])

        updated_items: List[ColumnMappingItem] = []
        for col in file_info.headers:
            target = new_mappings.get(col, "")
            is_req = target in req_list
            updated_items.append(ColumnMappingItem(
                source_column=col,
                target_field=target,
                confidence=1.0 if target else 0.0,
                is_required=is_req,
                is_mapped=bool(target),
                alternatives=list(COLUMN_VARIATIONS.get(file_type, {}).keys())
            ))

        file_info.column_mappings = updated_items
        session.updated_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    async def validate_session(self, upload_id: str) -> UploadSessionState:
        """Executes full multi-file validation, normalizations, and relationship checks."""
        session = self._sessions.get(upload_id)
        if not session:
            raise ValueError(f"Upload session '{upload_id}' not found.")

        session.status = DatasetStatus.VALIDATING
        all_issues: List[ValidationIssue] = []
        summaries: Dict[str, FileValidationSummary] = {}
        parsed_records: Dict[str, List[Dict[str, Any]]] = {}

        # 1. Validate Payments (Mandatory)
        if "payments" not in session.files:
            raise ValueError("Payments file is required to create a financial dataset.")

        for ftype, finfo in session.files.items():
            f_bytes = self._raw_file_contents[upload_id].get(ftype)
            if not f_bytes:
                continue

            # Verify required mappings exist
            req_fields = REQUIRED_FIELDS.get(ftype, [])
            mapped_targets = {m.target_field for m in finfo.column_mappings if m.target_field}
            missing_req = [rf for rf in req_fields if rf not in mapped_targets]
            if missing_req:
                raise ValueError(f"File '{ftype}' is missing required field mappings: {', '.join(missing_req)}")

            # Process rows
            v_summary, records, f_issues = self._process_file_rows(
                ftype=ftype,
                file_bytes=f_bytes,
                mappings={m.source_column: m.target_field for m in finfo.column_mappings if m.target_field}
            )
            summaries[ftype] = v_summary
            parsed_records[ftype] = records
            all_issues.extend(f_issues)
            finfo.is_valid = v_summary.error_count == 0

        # 2. Cross-File Relationship Warnings (Preserve Orphans as Warnings)
        payment_pids = {str(r.get("payment_id")) for r in parsed_records.get("payments", []) if r.get("payment_id")}

        for ftype in ["settlements", "refunds", "fees"]:
            for idx, r in enumerate(parsed_records.get(ftype, []), start=2):
                pid = str(r.get("payment_id", ""))
                if pid and pid not in payment_pids:
                    issue = ValidationIssue(
                        issue_id=f"iss_{uuid.uuid4().hex[:8]}",
                        file_type=ftype,
                        row_number=idx,
                        column="payment_id",
                        code="ORPHAN_REFERENCE",
                        severity=IssueSeverity.WARNING,
                        message=f"{ftype.capitalize()} references uncaptured Payment ID '{pid}'. Flagged as potential anomaly.",
                        raw_value=pid
                    )
                    all_issues.append(issue)
                    summaries[ftype].warning_count += 1

        session.validation_summaries = summaries
        session.issues = all_issues
        self._parsed_rows_cache[upload_id] = parsed_records

        has_blocking_errors = any(s.error_count > 0 for s in summaries.values())
        session.status = DatasetStatus.READY if not has_blocking_errors else DatasetStatus.FAILED
        session.is_ready_to_confirm = not has_blocking_errors
        session.updated_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        return session

    def _process_file_rows(
        self,
        ftype: str,
        file_bytes: bytes,
        mappings: Dict[str, str]
    ) -> Tuple[FileValidationSummary, List[Dict[str, Any]], List[ValidationIssue]]:
        """Parses and validates individual file rows into canonical normalized records."""
        text = file_bytes.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))

        records: List[Dict[str, Any]] = []
        issues: List[ValidationIssue] = []
        seen_ids: set = set()
        error_count = 0
        warning_count = 0
        row_num = 1

        for raw_row in reader:
            row_num += 1
            row_has_error = False

            # Map to canonical keys
            mapped_row: Dict[str, Any] = {}
            for src_col, val in raw_row.items():
                if src_col in mappings and mappings[src_col]:
                    mapped_row[mappings[src_col]] = val.strip() if val else ""

            # Check ID
            id_key = f"{ftype[:-1]}_id" if ftype != "fees" else "payment_id"
            record_id = mapped_row.get(id_key)
            if not record_id:
                issue = ValidationIssue(
                    issue_id=f"iss_{uuid.uuid4().hex[:8]}",
                    file_type=ftype,
                    row_number=row_num,
                    column=id_key,
                    code="MISSING_ID",
                    severity=IssueSeverity.ERROR,
                    message=f"Missing required identifier '{id_key}'."
                )
                issues.append(issue)
                error_count += 1
                row_has_error = True
            elif ftype == "payments" and record_id in seen_ids:
                issue = ValidationIssue(
                    issue_id=f"iss_{uuid.uuid4().hex[:8]}",
                    file_type=ftype,
                    row_number=row_num,
                    column="payment_id",
                    code="DUPLICATE_PAYMENT_ID",
                    severity=IssueSeverity.ERROR,
                    message=f"Duplicate Payment ID '{record_id}' detected.",
                    raw_value=record_id
                )
                issues.append(issue)
                error_count += 1
                row_has_error = True
            else:
                seen_ids.add(record_id)

            # Amount Normalization
            amt_key = "amount" if ftype == "payments" else f"{ftype[:-1]}_amount"
            if amt_key in mapped_row:
                raw_amt = mapped_row[amt_key]
                try:
                    dec_amt = to_decimal(raw_amt)
                    if dec_amt < Decimal("0.00"):
                        issue = ValidationIssue(
                            issue_id=f"iss_{uuid.uuid4().hex[:8]}",
                            file_type=ftype,
                            row_number=row_num,
                            column=amt_key,
                            code="NEGATIVE_AMOUNT",
                            severity=IssueSeverity.ERROR,
                            message=f"Negative monetary amount '{raw_amt}' not allowed.",
                            raw_value=raw_amt
                        )
                        issues.append(issue)
                        error_count += 1
                        row_has_error = True
                    else:
                        mapped_row[amt_key] = float(dec_amt)
                except Exception:
                    issue = ValidationIssue(
                        issue_id=f"iss_{uuid.uuid4().hex[:8]}",
                        file_type=ftype,
                        row_number=row_num,
                        column=amt_key,
                        code="INVALID_AMOUNT",
                        severity=IssueSeverity.ERROR,
                        message=f"Invalid monetary format '{raw_amt}'.",
                        raw_value=raw_amt
                    )
                    issues.append(issue)
                    error_count += 1
                    row_has_error = True

            # Date Normalization
            date_key = "created_at" if ftype == "payments" else f"{ftype[:-1]}_date"
            if date_key in mapped_row and mapped_row[date_key]:
                raw_d = mapped_row[date_key]
                norm_d = self._normalize_date(raw_d)
                if not norm_d:
                    issue = ValidationIssue(
                        issue_id=f"iss_{uuid.uuid4().hex[:8]}",
                        file_type=ftype,
                        row_number=row_num,
                        column=date_key,
                        code="INVALID_DATE",
                        severity=IssueSeverity.WARNING,
                        message=f"Unrecognized date format '{raw_d}'.",
                        raw_value=raw_d
                    )
                    issues.append(issue)
                    warning_count += 1
                else:
                    mapped_row[date_key] = norm_d

            # Status Normalization
            status_key = f"{ftype[:-1]}_status"
            if status_key in mapped_row and mapped_row[status_key]:
                mapped_row[status_key] = mapped_row[status_key].upper()

            if not row_has_error:
                records.append(mapped_row)

        summary = FileValidationSummary(
            file_type=ftype,
            total_rows=row_num - 1,
            valid_rows=len(records),
            warning_count=warning_count,
            error_count=error_count,
            is_blocking=error_count > 0,
            preview_rows=records[:10]
        )
        return summary, records, issues

    def _normalize_date(self, raw: str) -> Optional[str]:
        formats = [
            "%Y-%m-%d",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%m/%d/%Y"
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(raw.strip(), fmt)
                return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                continue
        return None

    async def confirm_and_create_dataset(
        self,
        upload_id: str,
        request: Optional[ConfirmDatasetRequest] = None
    ) -> ConfirmDatasetResponse:
        """Commits the uploaded dataset, auto-triggers reconciliation & exception detection."""
        session = self._sessions.get(upload_id)
        if not session or not session.is_ready_to_confirm:
            raise ValueError("Upload session has blocking validation errors or is not ready for import.")

        req = request or ConfirmDatasetRequest()
        dataset_id = f"upload_{datetime.utcnow().strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}"
        dataset_name = req.dataset_name or f"Imported Dataset {datetime.utcnow().strftime('%d %b %Y %H:%M')}"

        parsed_records = self._parsed_rows_cache.get(upload_id, {})

        # 1. Store records via dataset_service
        for ftype, rows in parsed_records.items():
            sum_dict = session.validation_summaries.get(ftype, FileValidationSummary(file_type=ftype)).model_dump()
            await dataset_service.store_records(
                dataset_id=dataset_id,
                file_type=ftype,
                records=rows,
                summary=sum_dict
            )

        # 2. Register Dataset Metadata in Datasets Collection
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        meta = {
            "dataset_id": dataset_id,
            "name": dataset_name,
            "source_type": "UPLOAD",
            "status": "RECONCILING",
            "merchant_id": req.merchant_id,
            "currency": req.currency,
            "timezone": req.timezone,
            "files": list(session.files.keys()),
            "total_transactions": len(parsed_records.get("payments", [])),
            "created_at": now_str,
            "updated_at": now_str
        }

        db = db_manager.get_db()
        if db is not None:
            await db["datasets"].insert_one(dict(meta))

        # 3. Auto-Reconcile
        recon_res = await reconciliation_engine.reconcile(dataset_id)

        # 4. Auto-Detect Exceptions
        det_res = await exception_detector.detect_exceptions(dataset_id)

        # Update dataset status to RECONCILED
        meta["status"] = "RECONCILED"
        meta["exception_count"] = det_res.exceptions_detected
        meta["unexplained_difference"] = recon_res.unexplained_difference
        meta["total_volume"] = recon_res.total_volume
        meta["updated_at"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        if db is not None:
            await db["datasets"].update_one(
                {"dataset_id": dataset_id},
                {"$set": {
                    "status": "RECONCILED",
                    "exception_count": det_res.exceptions_detected,
                    "unexplained_difference": recon_res.unexplained_difference,
                    "total_volume": recon_res.total_volume,
                    "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
                }}
            )
        else:
            self._datasets_in_memory[dataset_id] = meta

        return ConfirmDatasetResponse(
            success=True,
            dataset_id=dataset_id,
            dataset_name=dataset_name,
            status=DatasetStatus.RECONCILED,
            reconciliation_summary=recon_res.model_dump(),
            exceptions_detected=det_res.exceptions_detected,
            created_at=now_str
        )

    async def list_all_datasets(self) -> List[DatasetListItem]:
        """Lists all imported and synthetic datasets with live stats."""
        datasets: List[DatasetListItem] = []

        db = db_manager.get_db()
        if db is not None:
            docs = await db["datasets"].find({}, {"_id": 0}).sort("created_at", -1).to_list(length=None)
            for d in docs:
                datasets.append(DatasetListItem(
                    dataset_id=d.get("dataset_id"),
                    name=d.get("name", d.get("dataset_id")),
                    source_type=d.get("source_type", "UPLOAD"),
                    status=d.get("status", "RECONCILED"),
                    transaction_count=d.get("total_transactions", 0),
                    exception_count=d.get("exception_count", 0),
                    total_volume=d.get("total_volume", 0.0),
                    unexplained_difference=d.get("unexplained_difference", 0.0),
                    created_at=d.get("created_at", ""),
                    files=d.get("files", [])
                ))

        # Add active memory uploaded datasets
        for did, dmeta in self._datasets_in_memory.items():
            if not any(x.dataset_id == did for x in datasets):
                datasets.append(DatasetListItem(
                    dataset_id=did,
                    name=dmeta.get("name", did),
                    source_type=dmeta.get("source_type", "UPLOAD"),
                    status=dmeta.get("status", "RECONCILED"),
                    transaction_count=dmeta.get("total_transactions", 0),
                    exception_count=dmeta.get("exception_count", 0),
                    total_volume=dmeta.get("total_volume", 0.0),
                    unexplained_difference=dmeta.get("unexplained_difference", 0.0),
                    created_at=dmeta.get("created_at", ""),
                    files=dmeta.get("files", [])
                ))

        # Add active memory synthetic datasets if not in DB
        from app.services.data_generator import data_generator
        for sid, scache in data_generator._cache.items():
            if not any(x.dataset_id == sid for x in datasets):
                p_count = len(scache.get("payments", []))
                datasets.append(DatasetListItem(
                    dataset_id=sid,
                    name=f"Synthetic Benchmark ({sid})",
                    source_type="SYNTHETIC",
                    status="RECONCILED",
                    transaction_count=p_count,
                    exception_count=0,
                    total_volume=sum(float(p.get("amount", 0.0)) for p in scache.get("payments", [])),
                    unexplained_difference=0.0,
                    created_at=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                    files=["payments", "settlements", "refunds", "fees"]
                ))

        return datasets


upload_pipeline = UploadPipelineService()
