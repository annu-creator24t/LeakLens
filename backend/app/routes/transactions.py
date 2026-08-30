from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from app.services.reconciliation_engine import reconciliation_engine
from app.services.exception_detector import exception_detector
from app.services.data_generator import data_generator
from app.services.dataset_service import dataset_service
from app.utils.money import to_decimal

router = APIRouter(tags=["Transactions & Datasets"])


class StatusUpdateRequest(BaseModel):
    status: str


@router.get("/datasets")
async def list_available_datasets():
    """
    Returns list of active datasets and generated benchmarks for dataset selection.
    """
    from app.services.upload_pipeline import upload_pipeline
    datasets = []
    
    # 1. From upload pipeline (both DB and memory uploads + generator)
    pipeline_ds = await upload_pipeline.list_all_datasets()
    for d in pipeline_ds:
        datasets.append({
            "dataset_id": d.dataset_id,
            "name": d.name,
            "transaction_count": d.transaction_count,
            "created_at": d.created_at,
            "type": d.source_type,
            "exception_count": d.exception_count,
            "total_volume": d.total_volume,
            "unexplained_difference": d.unexplained_difference
        })

    # 2. From generator cache / folders
    for ds_id, meta in data_generator.list_generated_datasets().items():
        if not any(x["dataset_id"] == ds_id for x in datasets):
            datasets.append({
                "dataset_id": ds_id,
                "name": f"Benchmark ({meta.get('transaction_count', 0):,} txs - {meta.get('anomaly_rate', 0)*100:.0f}% anomalies)",
                "transaction_count": meta.get("transaction_count", 0),
                "created_at": meta.get("generated_at"),
                "type": "BENCHMARK"
            })

    # 3. From dataset service memory
    for sess_id in dataset_service._memory_sessions.keys():
        if not any(d["dataset_id"] == sess_id for d in datasets):
            datasets.append({
                "dataset_id": sess_id,
                "name": f"Uploaded Session ({sess_id[:12]})",
                "transaction_count": len(dataset_service._memory_records.get(sess_id, {}).get("payments", [])),
                "created_at": dataset_service._memory_sessions[sess_id].get("created_at"),
                "type": "UPLOADED"
            })

    return {"datasets": datasets}


_transactions_cache: Dict[str, List[Dict[str, Any]]] = {}


async def _get_or_build_reconciled_records(dataset_id: str) -> List[Dict[str, Any]]:
    """Retrieves or precomputes reconciled transaction ledger with expected/actual amounts."""
    if dataset_id in _transactions_cache:
        return _transactions_cache[dataset_id]

    summary = await reconciliation_engine.get_summary(dataset_id)
    if not summary:
        await reconciliation_engine.reconcile(dataset_id)

    payments, settlements, refunds, fees = await reconciliation_engine._fetch_all_records(dataset_id)

    settlements_by_pid = {}
    for s in settlements:
        settlements_by_pid.setdefault(str(s["payment_id"]), []).append(s)

    refunds_by_pid = {}
    for r in refunds:
        refunds_by_pid.setdefault(str(r["payment_id"]), []).append(r)

    fees_by_pid = {str(f["payment_id"]): f for f in fees}

    exc_list, _ = await exception_detector.get_exceptions(dataset_id, limit=100000)
    exc_by_pid = {e["payment_id"]: e for e in exc_list if e.get("payment_id")}

    records = []
    for p in payments:
        pid = str(p["payment_id"])
        amt = to_decimal(p.get("amount", "0"))
        p_refunds = refunds_by_pid.get(pid, [])
        ref_amt = sum((to_decimal(r.get("refund_amount", "0")) for r in p_refunds), to_decimal("0"))
        
        f_doc = fees_by_pid.get(pid)
        if f_doc:
            f_amt = to_decimal(f_doc.get("fee_amount", "0"))
            t_amt = to_decimal(f_doc.get("tax_amount", "0"))
        else:
            f_amt = (amt * to_decimal("0.018")).quantize(to_decimal("0.01"))
            t_amt = (f_amt * to_decimal("0.18")).quantize(to_decimal("0.01"))

        expected = (amt - ref_amt - f_amt - t_amt).quantize(to_decimal("0.01"))
        if expected < to_decimal("0.00"):
            expected = to_decimal("0.00")

        p_settles = settlements_by_pid.get(pid, [])
        actual = sum((to_decimal(s.get("settlement_amount", "0")) for s in p_settles), to_decimal("0"))
        diff = abs(expected - actual)

        tx_status = "RECONCILED"
        if pid in exc_by_pid:
            tx_status = exc_by_pid[pid]["primary_exception_type"]
        elif p.get("payment_status") != "SUCCESS":
            tx_status = p.get("payment_status", "FAILED")
        elif diff > to_decimal("0.01"):
            tx_status = "MISMATCH"

        rec = {
            "payment_id": pid,
            "order_id": p.get("order_id", ""),
            "merchant_id": p.get("merchant_id", ""),
            "amount": float(amt),
            "currency": p.get("currency", "INR"),
            "payment_status": p.get("payment_status", "SUCCESS"),
            "payment_method": p.get("payment_method", "CARD"),
            "created_at": p.get("created_at", ""),
            "refund_amount": float(ref_amt),
            "fee_amount": float(f_amt + t_amt),
            "expected_settlement": float(expected),
            "actual_settlement": float(actual),
            "difference": float(diff),
            "status": tx_status,
            "has_exception": pid in exc_by_pid,
            "exception_id": exc_by_pid[pid]["exception_id"] if pid in exc_by_pid else None
        }
        records.append(rec)

    _transactions_cache[dataset_id] = records
    return records


@router.get("/transactions/{dataset_id}")
async def list_transactions(
    dataset_id: str,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=500)
):
    """
    Retrieves reconciled transaction list with expected vs actual settlements, differences, and statuses.
    """
    records = await _get_or_build_reconciled_records(dataset_id)

    # Filter
    filtered = records
    if status_filter and status_filter != "ALL":
        filtered = [r for r in filtered if r["status"] == status_filter]
    if search:
        q = search.strip().lower()
        filtered = [
            r for r in filtered if
            q in r["payment_id"].lower() or
            q in r["order_id"].lower() or
            q in r["status"].lower()
        ]

    total = len(filtered)
    start = (page - 1) * limit
    end = start + limit

    return {
        "dataset_id": dataset_id,
        "total": total,
        "page": page,
        "limit": limit,
        "items": filtered[start:end]
    }


@router.get("/transactions/{dataset_id}/{payment_id}")
async def get_transaction_detail(dataset_id: str, payment_id: str):
    """
    Retrieves full transaction audit ledger with raw payment, refunds, fees, settlements, and calculation.
    """
    payments, settlements, refunds, fees = await reconciliation_engine._fetch_all_records(dataset_id)
    
    payment = next((p for p in payments if str(p["payment_id"]) == payment_id), None)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment '{payment_id}' not found in dataset '{dataset_id}'."
        )

    p_settlements = [s for s in settlements if str(s["payment_id"]) == payment_id]
    p_refunds = [r for r in refunds if str(r["payment_id"]) == payment_id]
    p_fee = next((f for f in fees if str(f["payment_id"]) == payment_id), None)

    amt = to_decimal(payment.get("amount", "0"))
    ref_amt = sum((to_decimal(r.get("refund_amount", "0")) for r in p_refunds), to_decimal("0"))
    
    if p_fee:
        f_amt = to_decimal(p_fee.get("fee_amount", "0"))
        t_amt = to_decimal(p_fee.get("tax_amount", "0"))
    else:
        f_amt = (amt * to_decimal("0.018")).quantize(to_decimal("0.01"))
        t_amt = (f_amt * to_decimal("0.18")).quantize(to_decimal("0.01"))

    expected = (amt - ref_amt - f_amt - t_amt).quantize(to_decimal("0.01"))
    if expected < to_decimal("0.00"):
        expected = to_decimal("0.00")

    actual = sum((to_decimal(s.get("settlement_amount", "0")) for s in p_settlements), to_decimal("0"))
    diff = abs(expected - actual)

    # Check exception
    exc_list, _ = await exception_detector.get_exceptions(dataset_id, limit=100000)
    exc = next((e for e in exc_list if e.get("payment_id") == payment_id), None)

    timeline = [
        {"event": "Payment Initiated", "timestamp": payment.get("created_at"), "details": f"₹{amt:,.2f} via {payment.get('payment_method', 'N/A')}"},
        {"event": f"Payment {payment.get('payment_status')}", "timestamp": payment.get("created_at"), "details": f"Order: {payment.get('order_id')}"},
    ]
    for r in p_refunds:
        timeline.append({"event": "Refund Processed", "timestamp": r.get("refund_date"), "details": f"Refund ID: {r.get('refund_id')}, Amount: ₹{to_decimal(r.get('refund_amount', 0)):,.2f}"})
    for s in p_settlements:
        timeline.append({"event": "Settlement Payout", "timestamp": s.get("settlement_date"), "details": f"Settlement ID: {s.get('settlement_id')}, Amount: ₹{to_decimal(s.get('settlement_amount', 0)):,.2f}"})
    if exc:
        timeline.append({"event": f"Anomaly Flagged: {exc['primary_exception_type']}", "timestamp": exc.get("detected_at"), "details": exc.get("description")})

    return {
        "payment": payment,
        "settlements": p_settlements,
        "refunds": p_refunds,
        "fee": p_fee or {"fee_amount": float(f_amt), "tax_amount": float(t_amt)},
        "calculation": {
            "payment_amount": float(amt),
            "refund_deduction": float(ref_amt),
            "fee_deduction": float(f_amt),
            "tax_deduction": float(t_amt),
            "expected_settlement": float(expected),
            "actual_settlement": float(actual),
            "difference": float(diff),
        },
        "status": exc["primary_exception_type"] if exc else ("RECONCILED" if diff <= to_decimal("0.01") else "MISMATCH"),
        "exception": exc,
        "timeline": timeline
    }


@router.patch("/exceptions/{dataset_id}/{exception_id}/status")
async def update_exception_status(dataset_id: str, exception_id: str, payload: StatusUpdateRequest):
    """
    Updates exception investigation status (OPEN, INVESTIGATING, RESOLVED, IGNORED).
    """
    valid_statuses = ["OPEN", "INVESTIGATING", "RESOLVED", "IGNORED"]
    if payload.status.upper() not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Must be one of {valid_statuses}."
        )

    items, _ = await exception_detector.get_exceptions(dataset_id, limit=100000)
    for item in items:
        if item["exception_id"] == exception_id:
            item["status"] = payload.status.upper()
            return {"success": True, "exception_id": exception_id, "status": item["status"]}

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Exception '{exception_id}' not found."
    )
