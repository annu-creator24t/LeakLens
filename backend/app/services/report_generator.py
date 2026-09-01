import io
import time
import uuid
import csv
from datetime import datetime
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas

from app.schemas.reports import (
    ReportFilterParams,
    ReportMetadata,
    ReportPreviewResponse,
)
from app.services.reconciliation_engine import reconciliation_engine
from app.services.exception_detector import exception_detector
from app.services.action_center import action_center_service
from app.services.ai_investigator import ai_investigator
from app.services.dataset_service import dataset_service
from app.db.session import db_manager

METHODOLOGY_TEXT = (
    "LeakLens calculates expected settlement using the deterministic reconciliation engine and compares "
    "it against recorded settlement data. Exceptions are classified using deterministic financial rules. "
    "AI-generated investigations provide explanations based on structured evidence and do not alter financial calculations."
)


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas for dynamic running header and page numbering."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 800, "LEAKLENS  |  Financial Reconciliation & Investigation Audit Report")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 792, 541, 792)

        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 45, 541, 45)
        
        self.drawString(54, 32, "CONFIDENTIAL  —  For Merchant Finance & Audit Use Only")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(541, 32, page_str)
        self.restoreState()


def sanitize_csv_value(val: Any) -> Any:
    """Escapes leading formula injection characters (=, +, -, @) on text fields for spreadsheet safety."""
    if isinstance(val, str) and val:
        if val[0] in ("=", "@", "+", "-"):
            try:
                float(val)
                return val  # Legitimate number
            except ValueError:
                return f"'{val}"
    return val


class ReportGeneratorService:
    def __init__(self):
        self._report_history: Dict[str, List[ReportMetadata]] = {}  # dataset_id -> list
        self._pdf_cache: Dict[str, bytes] = {}  # report_id -> pdf_bytes

    async def build_report_data(
        self,
        dataset_id: str,
        filters: Optional[ReportFilterParams] = None
    ) -> ReportPreviewResponse:
        """Assembles authoritative financial metrics from all preceding deterministic layers."""
        f = filters or ReportFilterParams()

        # 1. Fetch Reconciliation Summary
        recon_summary = await reconciliation_engine.get_summary(dataset_id)
        if not recon_summary:
            recon_res = await reconciliation_engine.reconcile(dataset_id)
            recon_summary = recon_res.model_dump()

        # 2. Fetch Exception Summary
        exc_summary = await exception_detector.get_summary(dataset_id)
        if not exc_summary:
            det_res = await exception_detector.detect_exceptions(dataset_id)
            exc_summary = det_res.summary
        exc_dict = exc_summary.model_dump() if hasattr(exc_summary, "model_dump") else dict(exc_summary)

        # 3. Fetch Action Center Summary & Top Prioritized Issues
        act_summary = await action_center_service.get_summary(dataset_id)
        top_items, _ = await action_center_service.get_prioritized_exceptions(
            dataset_id=dataset_id,
            status_filter=f.status or "ALL",
            severity_filter=f.severity,
            type_filter=f.exception_type,
            limit=10
        )

        # 4. Fetch Stored AI Investigations for Top Issues
        ai_insights: List[Dict[str, Any]] = []
        for it in top_items[:5]:
            eid = it["exception_id"]
            stored = await ai_investigator.get_stored_investigation(dataset_id, eid)
            if stored:
                inv = stored.investigation
                ai_insights.append({
                    "exception_id": eid,
                    "payment_id": it.get("payment_id"),
                    "exception_type": it.get("exception_type"),
                    "summary": inv.summary,
                    "possible_causes": inv.possible_causes,
                    "recommended_actions": inv.recommended_actions,
                    "confidence": inv.confidence,
                })

        # 5. Calculate Investigation Activity & Resolution Rate
        total_exc = act_summary.total
        resolved_exc = act_summary.resolved
        resolution_rate = round((resolved_exc / total_exc * 100), 2) if total_exc > 0 else 100.0

        # Fetch audit event counts in single aggregation query
        db = db_manager.get_db()
        act_counts = {"started": 0, "notes": 0, "resolved": 0, "ignored": 0, "reopened": 0}
        if db is not None:
            c = db["investigation_audit_events"]
            pipeline = [
                {"$match": {"dataset_id": dataset_id}},
                {"$group": {"_id": "$action", "count": {"$sum": 1}}}
            ]
            async for doc in c.aggregate(pipeline):
                action_name = doc.get("_id", "")
                cnt = doc.get("count", 0)
                if action_name == "INVESTIGATION_STARTED":
                    act_counts["started"] = cnt
                elif action_name == "NOTE_ADDED":
                    act_counts["notes"] = cnt
                elif action_name == "RESOLVED":
                    act_counts["resolved"] = cnt
                elif action_name == "IGNORED":
                    act_counts["ignored"] = cnt
                elif action_name == "REOPENED":
                    act_counts["reopened"] = cnt

        return ReportPreviewResponse(
            dataset_id=dataset_id,
            generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            report_version="v1.0",
            filters=f,
            financial_overview={
                "total_transactions": recon_summary.get("total_transactions", 0),
                "matched_count": recon_summary.get("matched_count", 0),
                "exception_count": recon_summary.get("exception_count", 0),
                "total_volume": recon_summary.get("total_volume", 0.0),
                "expected_settlement": recon_summary.get("expected_settlement", 0.0),
                "actual_settlement": recon_summary.get("actual_settlement", 0.0),
                "unexplained_difference": recon_summary.get("unexplained_difference", 0.0),
                "reconciliation_rate": recon_summary.get("reconciliation_rate", 0.0),
            },
            exception_summary=exc_dict,
            severity_breakdown=recon_summary.get("severity_breakdown", {}),
            top_issues=top_items,
            investigation_status={
                "open": act_summary.open,
                "investigating": act_summary.investigating,
                "resolved": act_summary.resolved,
                "ignored": act_summary.ignored,
                "total": act_summary.total,
                "resolution_rate": resolution_rate,
                "total_unresolved_impact": act_summary.total_unresolved_impact,
            },
            investigation_activity=act_counts,
            ai_insights=ai_insights,
            methodology=METHODOLOGY_TEXT
        )

    def generate_pdf(self, preview: ReportPreviewResponse, report_id: str) -> bytes:
        """Generates a clean, professional, publication-ready A4 PDF report using ReportLab."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=54,
            rightMargin=54,
            topMargin=54,
            bottomMargin=54,
        )

        styles = getSampleStyleSheet()
        
        # Typography Styles
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0F172A"),
        )
        subtitle_style = ParagraphStyle(
            "DocSubTitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#475569"),
        )
        h2_style = ParagraphStyle(
            "H2",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#1E293B"),
            spaceBefore=10,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#334155"),
        )
        bold_body_style = ParagraphStyle(
            "BoldBody",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#0F172A"),
        )
        mono_style = ParagraphStyle(
            "Mono",
            parent=styles["Normal"],
            fontName="Courier",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#0F172A"),
        )
        callout_style = ParagraphStyle(
            "Callout",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#475569"),
        )

        story = []

        # 1. Header Banner
        story.append(Paragraph("LEAKLENS", title_style))
        story.append(Paragraph("Financial Settlement Intelligence & Reconciliation Report", subtitle_style))
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563EB"), spaceBefore=2, spaceAfter=8))

        # Metadata Header Box
        meta_data = [
            [
                Paragraph("<b>Report ID:</b>", body_style),
                Paragraph(report_id, mono_style),
                Paragraph("<b>Generated:</b>", body_style),
                Paragraph(preview.generated_at, body_style),
            ],
            [
                Paragraph("<b>Dataset Session:</b>", body_style),
                Paragraph(preview.dataset_id, mono_style),
                Paragraph("<b>Report Version:</b>", body_style),
                Paragraph(preview.report_version, body_style),
            ]
        ]
        meta_table = Table(meta_data, colWidths=[90, 160, 80, 157])
        meta_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 12))

        # 2. Executive Financial Overview
        story.append(Paragraph("1. Executive Financial Overview", h2_style))
        fin = preview.financial_overview
        
        fin_rows = [
            [
                Paragraph("<b>Total Captured Volume</b>", body_style),
                Paragraph(f"₹{fin.get('total_volume', 0.0):,.2f}", bold_body_style),
                Paragraph("<b>Reconciliation Rate</b>", body_style),
                Paragraph(f"{fin.get('reconciliation_rate', 0.0):.2f}%", bold_body_style),
            ],
            [
                Paragraph("<b>Expected Net Settlement</b>", body_style),
                Paragraph(f"₹{fin.get('expected_settlement', 0.0):,.2f}", bold_body_style),
                Paragraph("<b>Matched Records</b>", body_style),
                Paragraph(f"{fin.get('matched_count', 0):,} / {fin.get('total_transactions', 0):,}", body_style),
            ],
            [
                Paragraph("<b>Actual Bank Settlement</b>", body_style),
                Paragraph(f"₹{fin.get('actual_settlement', 0.0):,.2f}", bold_body_style),
                Paragraph("<b>Total Exceptions Flagged</b>", body_style),
                Paragraph(f"{fin.get('exception_count', 0):,}", bold_body_style),
            ],
            [
                Paragraph("<b>Net Discrepancy (Leakage)</b>", body_style),
                Paragraph(f"<font color='#E11D48'><b>₹{fin.get('unexplained_difference', 0.0):,.2f}</b></font>", bold_body_style),
                Paragraph("<b>Audit Status</b>", body_style),
                Paragraph("Deterministic Verification", body_style),
            ],
        ]
        fin_table = Table(fin_rows, colWidths=[140, 110, 130, 107])
        fin_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
            ("BACKGROUND", (0, 3), (1, 3), colors.HexColor("#FFF1F2")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(fin_table)
        story.append(Spacer(1, 12))

        # 3. Exception Breakdown (7 Classes)
        story.append(Paragraph("2. Deterministic Exception Breakdown", h2_style))
        exc_data = [
            [
                Paragraph("<b>Exception Category</b>", bold_body_style),
                Paragraph("<b>Count</b>", bold_body_style),
                Paragraph("<b>Total Financial Discrepancy</b>", bold_body_style),
            ]
        ]
        
        categories = [
            ("Missing Settlement", "missing_settlement_count", "missing_settlement_impact"),
            ("Duplicate Settlement", "duplicate_settlement_count", "duplicate_settlement_impact"),
            ("Amount Mismatch", "amount_mismatch_count", "amount_mismatch_impact"),
            ("Refund Mismatch", "refund_mismatch_count", "refund_mismatch_impact"),
            ("Fee Anomaly (Excess MDR)", "fee_anomaly_count", "fee_anomaly_impact"),
            ("Delayed Settlement (SLA Breach)", "delayed_settlement_count", "delayed_settlement_impact"),
            ("Orphan Settlement", "orphan_settlement_count", "orphan_settlement_impact"),
        ]
        
        sum_dict = preview.exception_summary
        for label, cnt_key, imp_key in categories:
            cnt = sum_dict.get(cnt_key, 0)
            imp = sum_dict.get(imp_key, 0.0)
            exc_data.append([
                Paragraph(label, body_style),
                Paragraph(str(cnt), mono_style),
                Paragraph(f"₹{imp:,.2f}", mono_style),
            ])
            
        exc_table = Table(exc_data, colWidths=[240, 80, 167])
        exc_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(exc_table)
        story.append(Spacer(1, 12))

        # 4. Top Prioritized Issues
        story.append(Paragraph("3. Top High-Priority Financial Issues", h2_style))
        story.append(Paragraph("Sorted strictly by Severity Priority → Impact Magnitude → Age.", callout_style))
        story.append(Spacer(1, 4))

        top_rows = [
            [
                Paragraph("<b>Sev</b>", bold_body_style),
                Paragraph("<b>Exception Type</b>", bold_body_style),
                Paragraph("<b>Payment ID</b>", bold_body_style),
                Paragraph("<b>Discrepancy</b>", bold_body_style),
                Paragraph("<b>Status</b>", bold_body_style),
            ]
        ]
        
        for it in preview.top_issues[:8]:
            top_rows.append([
                Paragraph(it.get("severity", "MED")[:4], mono_style),
                Paragraph(it.get("exception_type", "")[:26], body_style),
                Paragraph(str(it.get("payment_id") or it.get("exception_id", "")), mono_style),
                Paragraph(f"₹{it.get('amount_discrepancy', 0.0):,.2f}", mono_style),
                Paragraph(it.get("status", "OPEN"), mono_style),
            ])

        top_table = Table(top_rows, colWidths=[40, 160, 120, 97, 70])
        top_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(top_table)
        story.append(Spacer(1, 12))

        # 5. Investigation Lifecycle Status & Activity
        story.append(Paragraph("4. Investigation Lifecycle & Audit Summary", h2_style))
        inv_st = preview.investigation_status
        inv_act = preview.investigation_activity

        status_rows = [
            [
                Paragraph("<b>OPEN</b>", body_style),
                Paragraph(str(inv_st.get("open", 0)), mono_style),
                Paragraph("<b>Investigations Started</b>", body_style),
                Paragraph(str(inv_act.get("started", 0)), mono_style),
            ],
            [
                Paragraph("<b>INVESTIGATING</b>", body_style),
                Paragraph(str(inv_st.get("investigating", 0)), mono_style),
                Paragraph("<b>Investigation Notes Added</b>", body_style),
                Paragraph(str(inv_act.get("notes", 0)), mono_style),
            ],
            [
                Paragraph("<b>RESOLVED</b>", body_style),
                Paragraph(str(inv_st.get("resolved", 0)), mono_style),
                Paragraph("<b>Issues Reopened</b>", body_style),
                Paragraph(str(inv_act.get("reopened", 0)), mono_style),
            ],
            [
                Paragraph("<b>IGNORED</b>", body_style),
                Paragraph(str(inv_st.get("ignored", 0)), mono_style),
                Paragraph("<b>Resolution Rate</b>", body_style),
                Paragraph(f"{inv_st.get('resolution_rate', 0.0):.1f}%", bold_body_style),
            ],
        ]
        status_table = Table(status_rows, colWidths=[110, 110, 150, 117])
        status_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(status_table)
        story.append(Spacer(1, 12))

        # 6. Investigation Insights Section (where available)
        if preview.ai_insights:
            story.append(Paragraph("5. Grounded Investigation Analysis & Root Cause Hypotheses", h2_style))
            story.append(Paragraph(
                "<b>Notice:</b> The following diagnostic insights are grounded strictly on verified ledger evidence packets. "
                "They represent plausible root-cause hypotheses and recommended verification steps for finance operations.",
                callout_style
            ))
            story.append(Spacer(1, 4))

            for ins in preview.ai_insights[:2]:
                ai_box = [
                    [
                        Paragraph(f"<b>Exception:</b> {ins.get('exception_type')} ({ins.get('payment_id')})", bold_body_style),
                        Paragraph("<b>Basis:</b> Verified Evidence", body_style)
                    ],
                    [
                        Paragraph(f"<b>Diagnostic Summary:</b> {ins.get('summary')}", body_style),
                        Paragraph("", body_style)
                    ]
                ]
                t_ai = Table(ai_box, colWidths=[360, 127])
                t_ai.setStyle(TableStyle([
                    ("SPAN", (0, 1), (1, 1)),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#BFDBFE")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                story.append(t_ai)
                story.append(Spacer(1, 4))
            story.append(Spacer(1, 8))

        # 7. Audit Methodology & Disclaimer
        story.append(Paragraph("6. Audit Methodology & Ground Truth Statement", h2_style))
        story.append(Paragraph(preview.methodology, body_style))
        story.append(Spacer(1, 6))
        story.append(Paragraph("Generated by LeakLens SaaS Platform  •  https://github.com/annu-creator24t/LeakLens", callout_style))

        # Build PDF
        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer.getvalue()

    async def generate_csv_export(
        self,
        dataset_id: str,
        table_type: str,
        filters: Optional[ReportFilterParams] = None
    ) -> str:
        """Generates sanitized, deterministic UTF-8 CSV exports with stable column ordering."""
        output = io.StringIO()
        raw_writer = csv.writer(output)

        def write_row(row: List[Any]):
            raw_writer.writerow([sanitize_csv_value(c) for c in row])

        if table_type == "payments":
            records = await dataset_service.get_records(dataset_id, "payments")
            write_row(["payment_id", "order_id", "merchant_id", "amount", "currency", "payment_status", "payment_method", "created_at"])
            for r in records:
                write_row([
                    r.get("payment_id", ""),
                    r.get("order_id", ""),
                    r.get("merchant_id", ""),
                    f"{float(r.get('amount', 0.0)):.2f}",
                    r.get("currency", "INR"),
                    r.get("payment_status", ""),
                    r.get("payment_method", ""),
                    r.get("created_at", "")
                ])

        elif table_type == "settlements":
            records = await dataset_service.get_records(dataset_id, "settlements")
            write_row(["settlement_id", "payment_id", "settlement_amount", "settlement_status", "settlement_date"])
            for r in records:
                write_row([
                    r.get("settlement_id", ""),
                    r.get("payment_id", ""),
                    f"{float(r.get('settlement_amount', 0.0)):.2f}",
                    r.get("settlement_status", ""),
                    r.get("settlement_date", "")
                ])

        elif table_type == "refunds":
            records = await dataset_service.get_records(dataset_id, "refunds")
            write_row(["refund_id", "payment_id", "refund_amount", "refund_status", "refund_date"])
            for r in records:
                write_row([
                    r.get("refund_id", ""),
                    r.get("payment_id", ""),
                    f"{float(r.get('refund_amount', 0.0)):.2f}",
                    r.get("refund_status", ""),
                    r.get("refund_date", "")
                ])

        elif table_type == "fees":
            records = await dataset_service.get_records(dataset_id, "fees")
            write_row(["payment_id", "fee_amount", "tax_amount"])
            for r in records:
                write_row([
                    r.get("payment_id", ""),
                    f"{float(r.get('fee_amount', 0.0)):.2f}",
                    f"{float(r.get('tax_amount', 0.0)):.2f}"
                ])

        elif table_type == "reconciliation":
            recon = await reconciliation_engine.get_summary(dataset_id)
            if not recon:
                recon = (await reconciliation_engine.reconcile(dataset_id)).model_dump()
            write_row(["metric", "value"])
            write_row(["dataset_id", dataset_id])
            write_row(["total_transactions", recon.get("total_transactions", 0)])
            write_row(["matched_count", recon.get("matched_count", 0)])
            write_row(["exception_count", recon.get("exception_count", 0)])
            write_row(["total_volume", f"{recon.get('total_volume', 0.0):.2f}"])
            write_row(["expected_settlement", f"{recon.get('expected_settlement', 0.0):.2f}"])
            write_row(["actual_settlement", f"{recon.get('actual_settlement', 0.0):.2f}"])
            write_row(["unexplained_difference", f"{recon.get('unexplained_difference', 0.0):.2f}"])
            write_row(["reconciliation_rate", f"{recon.get('reconciliation_rate', 0.0):.2f}"])

        elif table_type == "exceptions":
            exceptions, _ = await exception_detector.get_exceptions(dataset_id=dataset_id, limit=100000)
            write_row(["exception_id", "payment_id", "exception_type", "severity", "financial_impact", "status", "description", "detected_at"])
            for e in exceptions:
                write_row([
                    e.get("exception_id", ""),
                    e.get("payment_id", ""),
                    e.get("primary_exception_type", e.get("exception_type", "")),
                    e.get("severity", ""),
                    f"{float(e.get('financial_impact', e.get('amount_discrepancy', 0.0))):.2f}",
                    e.get("status", "OPEN"),
                    e.get("description", ""),
                    e.get("detected_at", e.get("created_at", ""))
                ])

        elif table_type == "notes":
            db = db_manager.get_db()
            notes = []
            if db is not None:
                notes = await db["investigation_notes"].find({"dataset_id": dataset_id}, {"_id": 0}).sort("created_at", -1).to_list(length=None)
            write_row(["note_id", "exception_id", "actor", "note", "created_at"])
            for n in notes:
                write_row([
                    n.get("note_id", ""),
                    n.get("exception_id", ""),
                    n.get("actor", ""),
                    n.get("note", ""),
                    n.get("created_at", "")
                ])

        elif table_type == "audit":
            db = db_manager.get_db()
            audits = []
            if db is not None:
                audits = await db["investigation_audit_events"].find({"dataset_id": dataset_id}, {"_id": 0}).sort("created_at", 1).to_list(length=None)
            write_row(["audit_id", "exception_id", "action", "previous_status", "new_status", "note", "actor", "created_at"])
            for a in audits:
                write_row([
                    a.get("audit_id", ""),
                    a.get("exception_id", ""),
                    a.get("action", ""),
                    a.get("previous_status", ""),
                    a.get("new_status", ""),
                    a.get("note", ""),
                    a.get("actor", ""),
                    a.get("created_at", "")
                ])
        else:
            raise ValueError(f"Unknown table export type '{table_type}'.")

        return output.getvalue()

    async def record_report_history(self, meta: ReportMetadata, pdf_bytes: Optional[bytes] = None):
        """Records generated report metadata in memory and MongoDB."""
        self._report_history.setdefault(meta.dataset_id, []).append(meta)
        if pdf_bytes:
            self._pdf_cache[meta.report_id] = pdf_bytes

        db = db_manager.get_db()
        if db is not None:
            await db["report_history"].insert_one(meta.model_dump())

    async def get_report_history(self, dataset_id: str) -> List[ReportMetadata]:
        """Retrieves list of past generated reports for the dataset."""
        hist = list(self._report_history.get(dataset_id, []))
        db = db_manager.get_db()
        if db is not None:
            if not hist:
                docs = await db["report_history"].find({"dataset_id": dataset_id}, {"_id": 0}).sort("created_at", -1).to_list(length=None)
                hist = [ReportMetadata(**d) for d in docs]
                self._report_history[dataset_id] = hist

        hist.sort(key=lambda r: r.created_at, reverse=True)
        return hist

    def get_cached_pdf(self, report_id: str) -> Optional[bytes]:
        return self._pdf_cache.get(report_id)


report_generator = ReportGeneratorService()
