import os
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException, status
from app.schemas.upload import UploadResponse, ValidationErrorItem, ValidationSummary, DatasetUploadStatus
from app.services.csv_parser import csv_parser
from app.services.csv_validator import csv_validator
from app.services.dataset_service import dataset_service
from app.utils.validation import MAX_FILE_SIZE_BYTES, ALLOWED_FILE_EXTENSIONS

router = APIRouter(prefix="/upload", tags=["Data Ingestion & Validation"])


async def process_file_upload(
    file_type: str,
    file: UploadFile,
    dataset_id: Optional[str] = None
) -> UploadResponse:
    """Core processor for handling financial CSV uploads, validation, and storage."""
    # 1. Validate file extension
    filename = file.filename or ""
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_FILE_EXTENSIONS:
        return UploadResponse(
            success=False,
            file_type=file_type,
            dataset_id=dataset_id or "unassigned",
            summary=ValidationSummary(),
            errors=[
                ValidationErrorItem(
                    row=1,
                    field="file_extension",
                    code="INVALID_FILE_EXTENSION",
                    message=f"File '{filename}' must be a .csv file."
                )
            ]
        )

    # 2. Read bytes and check size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        return UploadResponse(
            success=False,
            file_type=file_type,
            dataset_id=dataset_id or "unassigned",
            summary=ValidationSummary(),
            errors=[
                ValidationErrorItem(
                    row=1,
                    field="file_size",
                    code="FILE_TOO_LARGE",
                    message=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
                )
            ]
        )

    # 3. Parse CSV structure
    headers, raw_rows, parse_errors = csv_parser.parse_bytes(file_bytes)
    if parse_errors:
        return UploadResponse(
            success=False,
            file_type=file_type,
            dataset_id=dataset_id or "unassigned",
            summary=ValidationSummary(total_rows=0, valid_rows=0, invalid_rows=0),
            errors=[
                ValidationErrorItem(
                    row=1,
                    field="file",
                    code="MALFORMED_CSV",
                    message=err
                ) for err in parse_errors
            ]
        )

    # 4. Initialize or get dataset session
    session = await dataset_service.get_or_create_session(dataset_id)
    active_dataset_id = session["dataset_id"]

    # 5. Validate and normalize records
    is_success, valid_records, errors, warnings, summary = csv_validator.validate_and_normalize(
        file_type=file_type,
        headers=headers,
        raw_rows=raw_rows
    )

    # 6. Store validated records if validation passed
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


@router.post("/payments", response_model=UploadResponse)
async def upload_payments(
    file: UploadFile = File(...),
    dataset_id: Optional[str] = Form(None)
):
    """Ingests, validates, normalizes, and stores payments.csv."""
    return await process_file_upload("payments", file, dataset_id)


@router.post("/settlements", response_model=UploadResponse)
async def upload_settlements(
    file: UploadFile = File(...),
    dataset_id: Optional[str] = Form(None)
):
    """Ingests, validates, normalizes, and stores settlements.csv."""
    return await process_file_upload("settlements", file, dataset_id)


@router.post("/refunds", response_model=UploadResponse)
async def upload_refunds(
    file: UploadFile = File(...),
    dataset_id: Optional[str] = Form(None)
):
    """Ingests, validates, normalizes, and stores refunds.csv."""
    return await process_file_upload("refunds", file, dataset_id)


@router.post("/fees", response_model=UploadResponse)
async def upload_fees(
    file: UploadFile = File(...),
    dataset_id: Optional[str] = Form(None)
):
    """Ingests, validates, normalizes, and stores fees.csv."""
    return await process_file_upload("fees", file, dataset_id)


@router.get("/status", response_model=DatasetUploadStatus)
async def get_upload_status(
    dataset_id: str = Query(..., description="Dataset session identifier")
):
    """Fetches the upload and validation status for a specific dataset session."""
    session = await dataset_service.get_session_status(dataset_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset session '{dataset_id}' not found."
        )

    return DatasetUploadStatus(
        dataset_id=session["dataset_id"],
        created_at=str(session.get("created_at", "")),
        updated_at=str(session.get("updated_at", "")),
        uploaded_files=session.get("uploaded_files", []),
        file_summaries=session.get("file_summaries", {}),
        status=session.get("status", "IN_PROGRESS")
    )
