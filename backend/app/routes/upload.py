import os
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status

from app.schemas.upload import UploadResponse, ValidationErrorItem, ValidationSummary
from app.schemas.upload_pipeline import (
    StartUploadResponse,
    FileUploadInfo,
    UploadSessionState,
    MappingUpdateRequest,
    ConfirmDatasetRequest,
    ConfirmDatasetResponse,
    DatasetListItem,
)
from app.services.upload_pipeline import upload_pipeline
from app.services.csv_parser import csv_parser
from app.services.csv_validator import csv_validator
from app.services.dataset_service import dataset_service
from app.utils.validation import MAX_FILE_SIZE_BYTES, ALLOWED_FILE_EXTENSIONS
from app.db.session import db_manager

router = APIRouter(prefix="", tags=["Data Ingestion & Dataset Management"])


# --- PHASE 11 MULTI-STEP INGESTION PIPELINE ---

@router.post("/upload/start", response_model=StartUploadResponse)
async def start_upload_session():
    """Starts a new financial CSV upload session."""
    try:
        return upload_pipeline.start_session()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize upload session: {str(e)}"
        )


@router.post("/upload/{upload_id}/file", response_model=FileUploadInfo)
async def upload_session_file(
    upload_id: str,
    file_type: str = Form(..., description="payments, settlements, refunds, or fees"),
    file: UploadFile = File(...)
):
    """Uploads an individual financial CSV file, performs size checks and schema auto-detection."""
    try:
        file_bytes = await file.read()
        return await upload_pipeline.ingest_file(
            upload_id=upload_id,
            file_type=file_type,
            original_filename=file.filename or "upload.csv",
            file_bytes=file_bytes
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/upload/{upload_id}/mapping")
async def update_column_mapping(upload_id: str, request: MappingUpdateRequest):
    """Updates custom user-defined column mappings for an uploaded file."""
    try:
        upload_pipeline.update_mappings(upload_id, request.file_type, request.mappings)
        return {"success": True, "message": "Column mappings updated successfully."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/upload/{upload_id}/validate", response_model=UploadSessionState)
async def validate_upload_session(upload_id: str):
    """Runs thorough validation, Decimal normalizations, duplicate detection, and cross-file checks."""
    try:
        return await upload_pipeline.validate_session(upload_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/upload/{upload_id}/validation", response_model=UploadSessionState)
async def get_session_validation(upload_id: str):
    """Retrieves current validation status, summaries, and issue breakdowns for the session."""
    session = upload_pipeline.get_session(upload_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload session not found.")
    return session


@router.post("/upload/{upload_id}/confirm", response_model=ConfirmDatasetResponse)
async def confirm_and_import_dataset(
    upload_id: str,
    payload: Optional[ConfirmDatasetRequest] = None
):
    """
    Commits the uploaded dataset, saves normalized records, and auto-triggers reconciliation & exception detection.
    """
    try:
        return await upload_pipeline.confirm_and_create_dataset(upload_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# --- DATASET MANAGEMENT ENDPOINTS ---


@router.get("/datasets/{dataset_id}")
async def get_dataset_metadata(dataset_id: str):
    """Retrieves individual dataset session metadata."""
    session = await dataset_service.get_session(dataset_id)
    if not session:
        db = db_manager.get_db()
        if db is not None:
            doc = await db["datasets"].find_one({"dataset_id": dataset_id}, {"_id": 0})
            if doc:
                return doc
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")
    return session


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str):
    """Cascade deletes dataset records, summaries, exceptions, notes, and audit events."""
    try:
        db = db_manager.get_db()
        if db is not None:
            await db["datasets"].delete_many({"dataset_id": dataset_id})
            await db["payments"].delete_many({"dataset_id": dataset_id})
            await db["settlements"].delete_many({"dataset_id": dataset_id})
            await db["refunds"].delete_many({"dataset_id": dataset_id})
            await db["fees"].delete_many({"dataset_id": dataset_id})
            await db["reconciliation_summaries"].delete_many({"dataset_id": dataset_id})
            await db["reconciliation_exceptions"].delete_many({"dataset_id": dataset_id})
            await db["exception_summaries"].delete_many({"dataset_id": dataset_id})
            await db["investigation_notes"].delete_many({"dataset_id": dataset_id})
            await db["investigation_audit_events"].delete_many({"dataset_id": dataset_id})
            await db["report_history"].delete_many({"dataset_id": dataset_id})

        return {"success": True, "dataset_id": dataset_id, "message": "Dataset cascade deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# --- LEGACY DIRECT UPLOAD ENDPOINTS (BACKWARD COMPATIBILITY) ---

@router.post("/upload/{file_type}", response_model=UploadResponse)
async def upload_file_legacy(
    file_type: str,
    file: UploadFile = File(...),
    dataset_id: Optional[str] = Form(None)
):
    """Legacy single file upload endpoint."""
    file_type = file_type.lower()
    if file_type not in ["payments", "settlements", "refunds", "fees"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file_type}'. Supported: payments, settlements, refunds, fees."
        )

    filename = file.filename or ""
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_FILE_EXTENSIONS:
        return UploadResponse(
            success=False,
            file_type=file_type,
            dataset_id=dataset_id or "unassigned",
            summary=ValidationSummary(),
            errors=[ValidationErrorItem(row=1, field="file_extension", code="INVALID_FILE_EXTENSION", message="File must be .csv")]
        )

    file_bytes = await file.read()
    headers, raw_rows, parse_errors = csv_parser.parse_bytes(file_bytes)
    if parse_errors:
        return UploadResponse(
            success=False,
            file_type=file_type,
            dataset_id=dataset_id or "unassigned",
            summary=ValidationSummary(),
            errors=[ValidationErrorItem(row=1, field="file", code="MALFORMED_CSV", message=err) for err in parse_errors]
        )

    session = await dataset_service.get_or_create_session(dataset_id)
    active_dataset_id = session["dataset_id"]

    is_success, valid_records, errors, warnings, summary = csv_validator.validate_and_normalize(
        file_type=file_type,
        headers=headers,
        raw_rows=raw_rows
    )

    if is_success and valid_records:
        await dataset_service.store_records(
            dataset_id=active_dataset_id,
            file_type=file_type,
            records=valid_records,
            summary=summary.model_dump()
        )

    return UploadResponse(
        success=is_success,
        file_type=file_type,
        dataset_id=active_dataset_id,
        summary=summary,
        errors=errors,
        warnings=warnings
    )
