from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_vendor
from app.models import (
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    Timesheet,
    TimesheetStatus,
    Assignment,
    Vendor,
    gen_id,
)
from app.schemas import (
    InvoiceOut,
    InvoiceGenerateFromTimesheets,
    InvoiceStatusUpdate,
    VendorInvoiceSummaryOut,
)

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


@router.get("", response_model=List[InvoiceOut])
def list_invoices(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    query = db.query(Invoice).filter(Invoice.vendor_id == current.vendor_id)
    if status_filter and status_filter.upper() != "ALL":
        try:
            status_enum = InvoiceStatus(status_filter.upper())
            query = query.filter(Invoice.status == status_enum)
        except ValueError:
            pass
    return query.order_by(Invoice.created_at.desc()).all()


@router.get("/summary", response_model=VendorInvoiceSummaryOut)
def get_invoice_summary(
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    invoices = db.query(Invoice).filter(Invoice.vendor_id == current.vendor_id).all()
    total_invoices = len(invoices)
    total_billed = sum(inv.total_amount for inv in invoices if inv.status != InvoiceStatus.CANCELLED)
    total_paid = sum(inv.total_amount for inv in invoices if inv.status == InvoiceStatus.PAID)
    total_outstanding = sum(inv.total_amount for inv in invoices if inv.status == InvoiceStatus.ISSUED)
    issued_count = sum(1 for inv in invoices if inv.status == InvoiceStatus.ISSUED)
    paid_count = sum(1 for inv in invoices if inv.status == InvoiceStatus.PAID)

    currency = "INR"
    if invoices:
        currency = invoices[0].currency

    return VendorInvoiceSummaryOut(
        total_invoices=total_invoices,
        total_billed=round(total_billed, 2),
        total_paid=round(total_paid, 2),
        total_outstanding=round(total_outstanding, 2),
        issued_count=issued_count,
        paid_count=paid_count,
        currency=currency,
    )


@router.post("/generate", response_model=InvoiceOut)
def generate_invoice_from_timesheets(
    payload: InvoiceGenerateFromTimesheets,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """
    Finds all APPROVED timesheets under this vendor in the billing period
    and automatically builds a formal client invoice.
    """
    timesheets = (
        db.query(Timesheet)
        .join(Assignment)
        .filter(
            Assignment.vendor_id == current.vendor_id,
            Timesheet.status == TimesheetStatus.APPROVED,
            Timesheet.week_start >= payload.billing_period_start,
            Timesheet.week_end <= payload.billing_period_end,
        )
        .all()
    )

    if not timesheets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No approved timesheets found in the selected billing period.",
        )

    # Generate sequential or formatted invoice number e.g. INV-202608-001
    count = db.query(Invoice).filter(Invoice.vendor_id == current.vendor_id).count() + 1
    period_str = payload.billing_period_start.strftime("%Y%m")
    inv_num = f"INV-{period_str}-{count:03d}"

    # Calculate item totals
    items_to_create = []
    subtotal = 0.0
    currency = timesheets[0].assignment.currency if timesheets[0].assignment else "INR"

    for ts in timesheets:
        hours = sum(e.total_hours for e in ts.entries)
        if hours <= 0:
            continue
        rate = ts.assignment.bill_rate if ts.assignment else 0.0
        amount = round(hours * rate, 2)
        subtotal += amount

        contractor_name = ts.assignment.contractor.name if (ts.assignment and ts.assignment.contractor) else "Contractor"
        role = ts.assignment.role if ts.assignment else "Consultant"
        project_name = ts.assignment.project_name if ts.assignment else "Project"

        items_to_create.append(
            InvoiceItem(
                timesheet_id=ts.id,
                contractor_name=contractor_name,
                project_name=project_name,
                role=role,
                hours=hours,
                rate=rate,
                amount=amount,
            )
        )

    if not items_to_create:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approved timesheets in this period have 0 logged hours.",
        )

    tax_rate = payload.tax_rate
    tax_amount = round(subtotal * (tax_rate / 100.0), 2)
    total_amount = round(subtotal + tax_amount, 2)

    invoice = Invoice(
        vendor_id=current.vendor_id,
        invoice_number=inv_num,
        client_name=payload.client_name,
        client_email=payload.client_email,
        client_address=payload.client_address,
        billing_period_start=payload.billing_period_start,
        billing_period_end=payload.billing_period_end,
        issue_date=date.today(),
        due_date=payload.due_date,
        subtotal=round(subtotal, 2),
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total_amount=total_amount,
        currency=currency,
        status=InvoiceStatus.ISSUED,
        notes=payload.notes,
        items=items_to_create,
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice_detail(
    invoice_id: str,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.vendor_id == current.vendor_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    return invoice


@router.patch("/{invoice_id}/status", response_model=InvoiceOut)
def update_invoice_status(
    invoice_id: str,
    payload: InvoiceStatusUpdate,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.vendor_id == current.vendor_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    invoice.status = payload.status
    db.commit()
    db.refresh(invoice)
    return invoice
