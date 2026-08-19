"""Invoice API.

Vendor:   review billable work -> preview -> generate -> submit -> approve ->
          mark paid (or reject, which releases the weeks for re-billing).
Contractor: read-only view of their own invoices with the full breakdown.

Every amount is produced by app.invoicing on the server. Requests carry only
selection and workflow input (which assignment, which period, an adjustment, a
reason); no client-supplied figure ever reaches a stored monetary column.
"""
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user, require_contractor, require_vendor
from app.models import (
    Assignment,
    Contractor,
    Invoice,
    InvoiceAudit,
    InvoiceLineType,
    InvoiceStatus,
    InvoiceTaxRule,
)
from app.schemas import (
    BillableAssignmentOut,
    BillableWeekOut,
    InvoiceGenerateRequest,
    InvoiceLineOut,
    InvoiceOut,
    InvoicePreviewOut,
    InvoicePreviewRequest,
    InvoiceSummaryOut,
    InvoiceTaxRuleOut,
    InvoiceTaxRuleUpsert,
    InvoiceTransitionRequest,
    PerformanceScoreOut,
)
from app import invoicing
from app.performance import calculate_performance, simulate_performance_value

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

#: Past-participle wording so refusal messages read naturally.
ACTION_VERBS = {
    "SUBMIT": "submitted",
    "APPROVE": "approved",
    "REJECT": "rejected",
    "MARK_PAID": "marked as paid",
}

#: Allowed lifecycle moves. Anything else is a 409.
TRANSITIONS = {
    "SUBMIT": ((InvoiceStatus.DRAFT, InvoiceStatus.GENERATED), InvoiceStatus.SUBMITTED),
    "APPROVE": ((InvoiceStatus.SUBMITTED,), InvoiceStatus.APPROVED),
    "REJECT": ((InvoiceStatus.GENERATED, InvoiceStatus.SUBMITTED), InvoiceStatus.REJECTED),
    "MARK_PAID": ((InvoiceStatus.APPROVED,), InvoiceStatus.PAID),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def audit(db: Session, invoice: Invoice, role: str, action: str, detail: Optional[str] = None):
    db.add(InvoiceAudit(invoice_id=invoice.id, actor_role=role, action=action, detail=detail))


def serialise(invoice: Invoice) -> InvoiceOut:
    hour_lines = [
        line for line in invoice.lines
        if line.line_type in (InvoiceLineType.REGULAR, InvoiceLineType.OVERTIME)
    ]
    return InvoiceOut(
        id=invoice.id, invoice_number=invoice.invoice_number,
        vendor_id=invoice.vendor_id, vendor_name=invoice.vendor.name if invoice.vendor else None,
        contractor_id=invoice.contractor_id,
        contractor_name=invoice.contractor.name if invoice.contractor else None,
        assignment_id=invoice.assignment_id, project_id=invoice.project_id,
        project_name=invoice.assignment.project_name if invoice.assignment else None,
        role=invoice.assignment.role if invoice.assignment else None,
        period_start=invoice.period_start, period_end=invoice.period_end,
        invoice_date=invoice.invoice_date, due_date=invoice.due_date, currency=invoice.currency,
        regular_hours=invoice.regular_hours, overtime_hours=invoice.overtime_hours,
        total_hours=invoice.total_hours, hourly_rate=invoice.hourly_rate,
        overtime_multiplier=invoice.overtime_multiplier,
        base_amount=invoice.base_amount, overtime_amount=invoice.overtime_amount,
        gross_amount=invoice.gross_amount, taxable_amount=invoice.taxable_amount,
        tax_amount=invoice.tax_amount, deduction_amount=invoice.deduction_amount,
        adjustment_amount=invoice.adjustment_amount, net_payable=invoice.net_payable,
        performance_score=invoice.performance_score,
        performance_adjusted_amount=invoice.performance_adjusted_amount,
        status=invoice.status, notes=invoice.notes, rejection_reason=invoice.rejection_reason,
        payment_reference=invoice.payment_reference, payment_date=invoice.payment_date,
        is_overdue=(
            invoice.status in (InvoiceStatus.GENERATED, InvoiceStatus.SUBMITTED, InvoiceStatus.APPROVED)
            and invoice.due_date < date.today()
        ),
        weeks_billed=len({line.week_start for line in hour_lines if line.week_start}),
        generated_at=invoice.generated_at, submitted_at=invoice.submitted_at,
        approved_at=invoice.approved_at, paid_at=invoice.paid_at, rejected_at=invoice.rejected_at,
        created_at=invoice.created_at,
        lines=[InvoiceLineOut.model_validate(line) for line in sorted(
            invoice.lines, key=lambda x: (x.week_start or date.min, x.line_type.value)
        )],
        audit_history=[
            f"{a.created_at:%Y-%m-%d %H:%M} {a.actor_role}: {a.action}"
            f"{': ' + a.detail if a.detail else ''}"
            for a in sorted(invoice.audits, key=lambda a: a.created_at or datetime.min)
        ],
    )


def vendor_assignment(db: Session, vendor_id: str, assignment_id: str) -> Assignment:
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id, Assignment.vendor_id == vendor_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    return assignment


def build_preview(
    db: Session, assignment: Assignment, payload: InvoicePreviewRequest
) -> tuple[invoicing.Calculation, Optional[float]]:
    if payload.period_start and payload.period_end and payload.period_end < payload.period_start:
        raise HTTPException(status_code=400, detail="Period end cannot be before period start.")
    sheets = invoicing.billable_timesheets(
        db, assignment.id, payload.period_start, payload.period_end
    )
    calc = invoicing.calculate_invoice(
        db, assignment, sheets,
        adjustment_amount=payload.adjustment_amount or 0,
        adjustment_note=payload.adjustment_note,
        overtime_multiplier=payload.overtime_multiplier,
    )
    score = calculate_performance(db, assignment.contractor_id).get("score")
    return calc, score


def preview_response(calc: invoicing.Calculation, score: Optional[float]) -> InvoicePreviewOut:
    return InvoicePreviewOut(
        assignment_id=calc.assignment_id, contractor_id=calc.contractor_id,
        contractor_name=calc.contractor_name, project_id=calc.project_id,
        project_name=calc.project_name, currency=calc.currency,
        period_start=calc.period_start, period_end=calc.period_end,
        hourly_rate=calc.hourly_rate, overtime_multiplier=calc.overtime_multiplier,
        regular_hours=calc.regular_hours, overtime_hours=calc.overtime_hours,
        total_hours=calc.total_hours, base_amount=calc.base_amount,
        overtime_amount=calc.overtime_amount, gross_amount=calc.gross_amount,
        taxable_amount=calc.taxable_amount, tax_amount=calc.tax_amount,
        deduction_amount=calc.deduction_amount, adjustment_amount=calc.adjustment_amount,
        net_payable=calc.net_payable, weeks_billed=calc.weeks,
        performance_score=score,
        performance_adjusted_amount=simulate_performance_value(calc.gross_amount, score),
        lines=[
            InvoiceLineOut(
                id=f"preview-{i}", line_type=line.line_type, description=line.description,
                week_start=line.week_start, week_end=line.week_end, quantity=line.quantity,
                rate=line.rate, amount=line.amount, timesheet_id=line.timesheet_id,
            )
            for i, line in enumerate(calc.lines)
        ],
        warnings=calc.warnings,
    )


# ---------------------------------------------------------------------------
# Vendor: tax configuration
# ---------------------------------------------------------------------------

@router.get("/vendor/tax-rules", response_model=List[InvoiceTaxRuleOut])
def list_tax_rules(current: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    return (
        db.query(InvoiceTaxRule)
        .filter(InvoiceTaxRule.vendor_id == current.vendor_id)
        .order_by(InvoiceTaxRule.sort_order, InvoiceTaxRule.code)
        .all()
    )


@router.put("/vendor/tax-rules", response_model=List[InvoiceTaxRuleOut])
def upsert_tax_rules(
    payload: List[InvoiceTaxRuleUpsert],
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Replace this vendor's tax configuration.

    Rates are configuration, not code. Already-generated invoices keep the rates
    they were priced with, because those live on the invoice's own lines.
    """
    codes = [rule.code.strip().upper() for rule in payload]
    if len(codes) != len(set(codes)):
        raise HTTPException(status_code=400, detail="Tax rule codes must be unique.")

    existing = {
        rule.code: rule
        for rule in db.query(InvoiceTaxRule).filter(InvoiceTaxRule.vendor_id == current.vendor_id)
    }
    for rule, code in zip(payload, codes):
        row = existing.pop(code, None)
        if row is None:
            row = InvoiceTaxRule(vendor_id=current.vendor_id, code=code)
            db.add(row)
        row.label = rule.label.strip()
        row.rule_type = rule.rule_type
        row.rate_percent = rule.rate_percent
        row.is_active = rule.is_active
        row.sort_order = rule.sort_order
    for orphan in existing.values():
        db.delete(orphan)
    db.commit()
    return list_tax_rules(current, db)


# ---------------------------------------------------------------------------
# Vendor: billable work and generation
# ---------------------------------------------------------------------------

@router.get("/vendor/billable", response_model=List[BillableAssignmentOut])
def billable(current: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    """Approved weekly reports that have not been billed yet, per contractor.

    This is the review step: the vendor sees exactly which weeks and hours would
    become an invoice before anything is generated.
    """
    assignments = db.query(Assignment).filter(Assignment.vendor_id == current.vendor_id).all()
    result: List[BillableAssignmentOut] = []
    for assignment in assignments:
        sheets = invoicing.billable_timesheets(db, assignment.id)
        if not sheets:
            continue
        calc = invoicing.calculate_invoice(db, assignment, sheets)
        weeks = [
            BillableWeekOut(
                timesheet_id=s.id, week_start=s.week_start, week_end=s.week_end,
                regular_hours=invoicing.money(sum(e.regular_hours or 0 for e in s.entries)),
                overtime_hours=invoicing.money(sum(e.overtime_hours or 0 for e in s.entries)),
                total_hours=invoicing.money(sum(e.total_hours or 0 for e in s.entries)),
                approved_at=s.approved_at, had_anomalies=bool(s.has_anomalies),
            )
            for s in sheets
        ]
        result.append(BillableAssignmentOut(
            assignment_id=assignment.id, contractor_id=assignment.contractor_id,
            contractor_name=assignment.contractor.name, project_id=assignment.project_id,
            project_name=assignment.project_name, role=assignment.role,
            currency=assignment.currency or "INR", hourly_rate=float(assignment.pay_rate or 0),
            weekly_capacity=int(assignment.working_hours or 40), weeks=weeks,
            regular_hours=calc.regular_hours, overtime_hours=calc.overtime_hours,
            total_hours=calc.total_hours, estimated_gross=calc.gross_amount,
            estimated_net=calc.net_payable,
            performance_score=calculate_performance(db, assignment.contractor_id).get("score"),
            earliest_week=min(w.week_start for w in weeks),
            latest_week=max(w.week_end for w in weeks),
        ))
    return sorted(result, key=lambda r: r.contractor_name)


@router.post("/vendor/preview", response_model=InvoicePreviewOut)
def preview(
    payload: InvoicePreviewRequest,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Price an invoice without persisting anything."""
    assignment = vendor_assignment(db, current.vendor_id, payload.assignment_id)
    calc, score = build_preview(db, assignment, payload)
    return preview_response(calc, score)


@router.post("/vendor/generate", response_model=InvoiceOut, status_code=201)
def generate(
    payload: InvoiceGenerateRequest,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Generate an invoice from approved, un-invoiced weekly reports.

    Runs as one transaction: the invoice, its lines and the claim on each
    weekly report all commit together or not at all. Re-running for the same
    weeks yields a 409 rather than a second invoice.
    """
    assignment = vendor_assignment(db, current.vendor_id, payload.assignment_id)
    if payload.invoice_date and payload.due_date and payload.due_date < payload.invoice_date:
        raise HTTPException(status_code=400, detail="Due date cannot be before the invoice date.")

    calc, score = build_preview(db, assignment, payload)
    if not calc.timesheet_ids:
        raise HTTPException(
            status_code=409,
            detail="No approved, un-invoiced hours in this period. Approve a weekly report first.",
        )

    try:
        invoice = invoicing.persist_invoice(
            db, assignment, calc,
            invoice_date=payload.invoice_date, due_date=payload.due_date, notes=payload.notes,
            performance_score=score,
            performance_adjusted_amount=simulate_performance_value(calc.gross_amount, score),
        )
        audit(
            db, invoice, "VENDOR", "GENERATED",
            f"{calc.weeks} week(s), {calc.total_hours:g}h, net {calc.net_payable:g} {calc.currency}",
        )
        db.commit()
    except invoicing.InvoiceError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc))
    except IntegrityError:
        # The unique index on invoice_lines.timesheet_id fired: a concurrent
        # request billed one of these weeks first.
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="These weekly reports have already been invoiced.",
        )

    db.refresh(invoice)
    return serialise(invoice)


# ---------------------------------------------------------------------------
# Vendor: listing, detail, workflow
# ---------------------------------------------------------------------------

@router.get("/vendor", response_model=List[InvoiceOut])
def list_invoices(
    contractor_id: Optional[str] = Query(default=None),
    project_id: Optional[str] = Query(default=None),
    status: Optional[InvoiceStatus] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    q: Optional[str] = Query(default=None, description="Invoice number or contractor name"),
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    query = db.query(Invoice).filter(Invoice.vendor_id == current.vendor_id)
    if contractor_id:
        query = query.filter(Invoice.contractor_id == contractor_id)
    if project_id:
        query = query.filter(Invoice.project_id == project_id)
    if status:
        query = query.filter(Invoice.status == status)
    if date_from:
        query = query.filter(Invoice.invoice_date >= date_from)
    if date_to:
        query = query.filter(Invoice.invoice_date <= date_to)
    if q:
        term = f"%{q.strip()}%"
        query = query.join(Contractor, Invoice.contractor_id == Contractor.id).filter(
            Invoice.invoice_number.ilike(term) | Contractor.name.ilike(term)
        )
    invoices = query.order_by(Invoice.invoice_date.desc(), Invoice.invoice_number.desc()).all()
    return [serialise(i) for i in invoices]


@router.get("/vendor/summary", response_model=InvoiceSummaryOut)
def summary(current: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    invoices = db.query(Invoice).filter(Invoice.vendor_id == current.vendor_id).all()
    billable_rows = billable(current, db)
    today = date.today()

    def count(*statuses) -> int:
        return len([i for i in invoices if i.status in statuses])

    paid_total = sum(i.net_payable for i in invoices if i.status == InvoiceStatus.PAID)
    outstanding = sum(
        i.net_payable for i in invoices
        if i.status in (InvoiceStatus.GENERATED, InvoiceStatus.SUBMITTED, InvoiceStatus.APPROVED)
    )
    return InvoiceSummaryOut(
        total_invoices=len(invoices),
        generated_count=count(InvoiceStatus.GENERATED),
        submitted_count=count(InvoiceStatus.SUBMITTED),
        approved_count=count(InvoiceStatus.APPROVED),
        paid_count=count(InvoiceStatus.PAID),
        rejected_count=count(InvoiceStatus.REJECTED),
        overdue_count=len([
            i for i in invoices
            if i.due_date < today
            and i.status in (InvoiceStatus.GENERATED, InvoiceStatus.SUBMITTED, InvoiceStatus.APPROVED)
        ]),
        gross_total=invoicing.money(sum(i.gross_amount for i in invoices)),
        tax_total=invoicing.money(sum(i.tax_amount for i in invoices)),
        deduction_total=invoicing.money(sum(i.deduction_amount for i in invoices)),
        net_total=invoicing.money(sum(i.net_payable for i in invoices)),
        paid_total=invoicing.money(paid_total),
        outstanding_total=invoicing.money(outstanding),
        billable_contractors=len(billable_rows),
        billable_hours=invoicing.money(sum(r.total_hours for r in billable_rows)),
        billable_estimated_net=invoicing.money(sum(r.estimated_net for r in billable_rows)),
        currency=invoices[0].currency if invoices else "INR",
    )


@router.post("/vendor/{invoice_id}/transition", response_model=InvoiceOut)
def transition(
    invoice_id: str,
    payload: InvoiceTransitionRequest,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Advance an invoice: submit, approve, reject or mark paid."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.vendor_id == current.vendor_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    allowed_from, target = TRANSITIONS[payload.action]
    if invoice.status not in allowed_from:
        expected = " or ".join(s.value for s in allowed_from)
        raise HTTPException(
            status_code=409,
            detail=(
                f"A {invoice.status.value} invoice cannot be {ACTION_VERBS[payload.action]}. "
                f"Only a {expected} invoice can be."
            ),
        )

    reason = (payload.reason or "").strip()
    now = datetime.utcnow()

    if payload.action == "SUBMIT":
        invoice.submitted_at = now
    elif payload.action == "APPROVE":
        invoice.approved_at = now
    elif payload.action == "REJECT":
        if not reason:
            raise HTTPException(status_code=400, detail="A rejection reason is required.")
        invoice.rejection_reason = reason
        invoice.rejected_at = now
        # Put the weeks back so corrected hours can be billed again.
        invoicing.release_timesheets(db, invoice)
    elif payload.action == "MARK_PAID":
        invoice.paid_at = now
        invoice.payment_date = payload.payment_date or date.today()
        invoice.payment_reference = (payload.payment_reference or "").strip() or None

    invoice.status = target
    audit(db, invoice, "VENDOR", target.value, reason or payload.payment_reference or None)
    db.commit()
    db.refresh(invoice)
    return serialise(invoice)


@router.get("/vendor/contractors/{contractor_id}/performance", response_model=PerformanceScoreOut)
def contractor_performance(
    contractor_id: str,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    contractor = db.query(Contractor).filter(
        Contractor.id == contractor_id, Contractor.vendor_id == current.vendor_id
    ).first()
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found.")
    result = calculate_performance(db, contractor_id)
    result["contractor_name"] = contractor.name
    return result


# ---------------------------------------------------------------------------
# Contractor
# ---------------------------------------------------------------------------

@router.get("/me", response_model=List[InvoiceOut])
def my_invoices(current: CurrentUser = Depends(require_contractor), db: Session = Depends(get_db)):
    """Invoices raised for this contractor's own approved work."""
    invoices = (
        db.query(Invoice)
        .filter(Invoice.contractor_id == current.contractor_id)
        .order_by(Invoice.invoice_date.desc(), Invoice.invoice_number.desc())
        .all()
    )
    return [serialise(i) for i in invoices]


@router.get("/me/performance", response_model=PerformanceScoreOut)
def my_performance(current: CurrentUser = Depends(require_contractor), db: Session = Depends(get_db)):
    contractor = db.query(Contractor).filter(Contractor.id == current.contractor_id).first()
    result = calculate_performance(db, current.contractor_id)
    result["contractor_name"] = contractor.name if contractor else None
    return result


# ---------------------------------------------------------------------------
# Shared detail route - declared last so it cannot shadow /vendor/* or /me
# ---------------------------------------------------------------------------

@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """One invoice, readable by the owning vendor or the contractor it bills."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    owns = (
        (current.vendor_id and invoice.vendor_id == current.vendor_id)
        or (current.contractor_id and invoice.contractor_id == current.contractor_id)
    )
    if not owns:
        raise HTTPException(status_code=403, detail="You do not have access to this invoice.")
    return serialise(invoice)
