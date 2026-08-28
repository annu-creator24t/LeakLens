import time
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse, Response
import io

from app.schemas.reports import (
    ReportFilterParams,
    ReportMetadata,
    ReportGenerateRequest,
    ReportGenerateResponse,
    ReportPreviewResponse,
    ReportHistoryListResponse,
)
from app.services.report_generator import report_generator

reports_router = APIRouter(prefix="/reports", tags=["Financial Reports"])
exports_router = APIRouter(prefix="/exports", tags=["Data Exports"])


@reports_router.get("/{dataset_id}/preview", response_model=ReportPreviewResponse)
async def get_report_preview(
    dataset_id: str,
    severity: Optional[str] = Query(None),
    exception_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    date_preset: Optional[str] = Query("ALL")
):
    """
    Returns structured preview data for live visualization before generating a PDF.
    """
    filters = ReportFilterParams(
        severity=severity,
        exception_type=exception_type,
        status=status_filter,
        date_preset=date_preset
    )
    try:
        return await report_generator.build_report_data(dataset_id, filters)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile report preview: {str(e)}"
        )


@reports_router.post("/{dataset_id}/generate", response_model=ReportGenerateResponse)
async def generate_report(
    dataset_id: str,
    payload: Optional[ReportGenerateRequest] = None
):
    """
    Generates a publication-ready PDF report, caches it, and records it in history.
    """
    start_time = time.perf_counter()
    req = payload or ReportGenerateRequest()
    filters = req.filters or ReportFilterParams()

    try:
        # Build Report Data
        preview = await report_generator.build_report_data(dataset_id, filters)
        
        # Generate PDF Bytes
        report_id = f"rep_{datetime.utcnow().strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}"
        pdf_bytes = report_generator.generate_pdf(preview, report_id)
        
        gen_ms = round((time.perf_counter() - start_time) * 1000, 2)
        download_url = f"/api/reports/{dataset_id}/{report_id}/download"

        meta = ReportMetadata(
            report_id=report_id,
            dataset_id=dataset_id,
            report_title="Financial Reconciliation & Investigation Audit Report",
            report_type="PDF",
            report_version="v1.0",
            filters=filters,
            created_at=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            generation_time_ms=gen_ms,
            download_url=download_url
        )

        # Record in history
        await report_generator.record_report_history(meta, pdf_bytes)

        return ReportGenerateResponse(
            success=True,
            report_id=report_id,
            download_url=download_url,
            generation_time_ms=gen_ms,
            metadata=meta
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )


@reports_router.get("/{dataset_id}", response_model=ReportHistoryListResponse)
async def get_recent_reports(dataset_id: str):
    """
    Retrieves previous report generation history for the dataset.
    """
    try:
        history = await report_generator.get_report_history(dataset_id)
        return ReportHistoryListResponse(dataset_id=dataset_id, reports=history)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch report history: {str(e)}"
        )


@reports_router.get("/{dataset_id}/{report_id}/download")
async def download_pdf_report(dataset_id: str, report_id: str):
    """
    Streams the generated PDF report.
    """
    pdf_bytes = report_generator.get_cached_pdf(report_id)
    if not pdf_bytes:
        # Re-generate if not in memory
        try:
            preview = await report_generator.build_report_data(dataset_id)
            pdf_bytes = report_generator.generate_pdf(preview, report_id)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=LeakLens_Report_{dataset_id}_{report_id}.pdf"
        }
    )


# --- CSV EXPORTS ROUTER ---

@exports_router.get("/{dataset_id}/payments.csv")
async def export_payments_csv(dataset_id: str):
    csv_str = await report_generator.generate_csv_export(dataset_id, "payments")
    return Response(
        content=csv_str,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=payments_{dataset_id}.csv"}
    )


@exports_router.get("/{dataset_id}/settlements.csv")
async def export_settlements_csv(dataset_id: str):
    csv_str = await report_generator.generate_csv_export(dataset_id, "settlements")
    return Response(
        content=csv_str,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=settlements_{dataset_id}.csv"}
    )


@exports_router.get("/{dataset_id}/refunds.csv")
async def export_refunds_csv(dataset_id: str):
    csv_str = await report_generator.generate_csv_export(dataset_id, "refunds")
    return Response(
        content=csv_str,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=refunds_{dataset_id}.csv"}
    )


@exports_router.get("/{dataset_id}/fees.csv")
async def export_fees_csv(dataset_id: str):
    csv_str = await report_generator.generate_csv_export(dataset_id, "fees")
    return Response(
        content=csv_str,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=fees_{dataset_id}.csv"}
    )


@exports_router.get("/{dataset_id}/reconciliation.csv")
async def export_reconciliation_csv(dataset_id: str):
    csv_str = await report_generator.generate_csv_export(dataset_id, "reconciliation")
    return Response(
        content=csv_str,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=reconciliation_{dataset_id}.csv"}
    )


@exports_router.get("/{dataset_id}/exceptions.csv")
async def export_exceptions_csv(dataset_id: str):
    csv_str = await report_generator.generate_csv_export(dataset_id, "exceptions")
    return Response(
        content=csv_str,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=exceptions_{dataset_id}.csv"}
    )


@exports_router.get("/{dataset_id}/notes.csv")
async def export_notes_csv(dataset_id: str):
    csv_str = await report_generator.generate_csv_export(dataset_id, "notes")
    return Response(
        content=csv_str,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=investigation_notes_{dataset_id}.csv"}
    )


@exports_router.get("/{dataset_id}/audit.csv")
async def export_audit_csv(dataset_id: str):
    csv_str = await report_generator.generate_csv_export(dataset_id, "audit")
    return Response(
        content=csv_str,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=audit_events_{dataset_id}.csv"}
    )
