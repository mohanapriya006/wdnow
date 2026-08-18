from datetime import date, datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_vendor, require_contractor
from app.models import (
    PayrollRun,
    PayrollItem,
    PayrollStatus,
    Timesheet,
    TimesheetStatus,
    Assignment,
    Contractor,
    gen_id,
)
from app.schemas import (
    PayrollRunOut,
    PayrollRunCreate,
    PayrollItemOut,
    ContractorPayrollSummaryOut,
    VendorPayrollSummaryOut,
)

router = APIRouter(prefix="/api/payroll", tags=["payroll"])


# ---------------------------------------------------------------------------
# Vendor Payroll Endpoints
# ---------------------------------------------------------------------------

@router.get("/vendor/summary", response_model=VendorPayrollSummaryOut)
def vendor_payroll_summary(
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    runs = db.query(PayrollRun).filter(PayrollRun.vendor_id == current.vendor_id).all()
    total_runs = len(runs)
    total_disbursed = sum(r.total_net_payout for r in runs if r.status == PayrollStatus.PAID)
    total_tax_withheld = sum(r.total_tax_withheld for r in runs if r.status == PayrollStatus.PAID)
    
    # Calculate pending approved timesheets not yet part of any paid payroll item
    paid_timesheet_ids = {
        item.timesheet_id
        for item in db.query(PayrollItem.timesheet_id)
        .join(PayrollRun)
        .filter(PayrollRun.vendor_id == current.vendor_id, PayrollItem.timesheet_id.isnot(None))
        .all()
    }

    approved_sheets = (
        db.query(Timesheet)
        .join(Assignment)
        .filter(
            Assignment.vendor_id == current.vendor_id,
            Timesheet.status == TimesheetStatus.APPROVED,
        )
        .all()
    )

    pending_disbursement = 0.0
    for ts in approved_sheets:
        if ts.id not in paid_timesheet_ids:
            hours = sum(e.total_hours for e in ts.entries)
            rate = ts.assignment.pay_rate if ts.assignment else 0.0
            pending_disbursement += hours * rate

    unique_contractors = len(
        {item.contractor_id for run in runs for item in run.items}
    )

    currency = "INR"
    if runs:
        currency = runs[0].currency

    return VendorPayrollSummaryOut(
        total_runs=total_runs,
        total_disbursed=round(total_disbursed, 2),
        total_tax_withheld=round(total_tax_withheld, 2),
        pending_disbursement=round(pending_disbursement, 2),
        active_contractors_paid=unique_contractors,
        currency=currency,
    )


@router.get("/vendor/runs", response_model=List[PayrollRunOut])
def list_vendor_payroll_runs(
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    return (
        db.query(PayrollRun)
        .filter(PayrollRun.vendor_id == current.vendor_id)
        .order_by(PayrollRun.created_at.desc())
        .all()
    )


@router.post("/vendor/run", response_model=PayrollRunOut)
def execute_payroll_run(
    payload: PayrollRunCreate,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """
    Pulls all APPROVED timesheets in the period that haven't been disbursed,
    calculates Gross wages, TDS Tax withholding, and Net Payout, and generates Pay Slips.
    """
    paid_timesheet_ids = {
        item.timesheet_id
        for item in db.query(PayrollItem.timesheet_id)
        .join(PayrollRun)
        .filter(PayrollRun.vendor_id == current.vendor_id, PayrollItem.timesheet_id.isnot(None))
        .all()
    }

    timesheets = (
        db.query(Timesheet)
        .join(Assignment)
        .filter(
            Assignment.vendor_id == current.vendor_id,
            Timesheet.status == TimesheetStatus.APPROVED,
            Timesheet.week_start >= payload.period_start,
            Timesheet.week_end <= payload.period_end,
        )
        .all()
    )

    unpaid_sheets = [ts for ts in timesheets if ts.id not in paid_timesheet_ids]

    if not unpaid_sheets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No unpaid approved timesheets found for the selected payroll period.",
        )

    count = db.query(PayrollRun).filter(PayrollRun.vendor_id == current.vendor_id).count() + 1
    period_str = payload.period_start.strftime("%Y%m")
    run_ref = f"PAY-{period_str}-{count:03d}"

    total_hours = 0.0
    total_gross = 0.0
    total_tax = 0.0
    total_net = 0.0
    items_to_create = []
    contractor_ids = set()
    currency = "INR"

    for ts in unpaid_sheets:
        regular = sum(e.regular_hours for e in ts.entries)
        overtime = sum(e.overtime_hours for e in ts.entries)
        hours = regular + overtime
        if hours <= 0:
            continue

        contractor_id = ts.assignment.contractor_id if ts.assignment else "C000"
        contractor_name = ts.assignment.contractor.name if (ts.assignment and ts.assignment.contractor) else "Contractor"
        project_name = ts.assignment.project_name if ts.assignment else "Project"
        role = ts.assignment.role if ts.assignment else "Contractor"
        pay_rate = ts.assignment.pay_rate if ts.assignment else 0.0
        currency = ts.assignment.currency if ts.assignment else "INR"

        gross = round(hours * pay_rate, 2)
        tax = round(gross * (payload.tax_rate / 100.0), 2)
        net = round(gross - tax, 2)

        total_hours += hours
        total_gross += gross
        total_tax += tax
        total_net += net
        contractor_ids.add(contractor_id)

        bank_ref = f"UTR-{uuid.uuid4().hex[:10].upper()}"

        items_to_create.append(
            PayrollItem(
                contractor_id=contractor_id,
                assignment_id=ts.assignment_id,
                timesheet_id=ts.id,
                contractor_name=contractor_name,
                project_name=project_name,
                role=role,
                period_start=ts.week_start,
                period_end=ts.week_end,
                regular_hours=regular,
                overtime_hours=overtime,
                total_hours=hours,
                pay_rate=pay_rate,
                gross_pay=gross,
                tax_rate=payload.tax_rate,
                tax_withheld=tax,
                net_payout=net,
                currency=currency,
                status=PayrollStatus.PAID,
                bank_reference=bank_ref,
            )
        )

    if not items_to_create:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approved timesheets in this period have 0 hours.",
        )

    payroll_run = PayrollRun(
        vendor_id=current.vendor_id,
        run_reference=run_ref,
        period_start=payload.period_start,
        period_end=payload.period_end,
        total_contractors=len(contractor_ids),
        total_hours=round(total_hours, 2),
        total_gross_pay=round(total_gross, 2),
        total_tax_withheld=round(total_tax, 2),
        total_net_payout=round(total_net, 2),
        currency=currency,
        status=PayrollStatus.PAID,
        payment_method=payload.payment_method,
        notes=payload.notes,
        disbursed_at=datetime.utcnow(),
        items=items_to_create,
    )

    db.add(payroll_run)
    db.commit()
    db.refresh(payroll_run)
    return payroll_run


# ---------------------------------------------------------------------------
# Contractor Payroll Endpoints
# ---------------------------------------------------------------------------

@router.get("/contractor/me", response_model=ContractorPayrollSummaryOut)
def contractor_payroll_summary(
    current: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    items = (
        db.query(PayrollItem)
        .filter(PayrollItem.contractor_id == current.contractor_id, PayrollItem.status == PayrollStatus.PAID)
        .order_by(PayrollItem.created_at.desc())
        .all()
    )

    lifetime_earnings = sum(item.net_payout for item in items)
    total_slips = len(items)
    last_disbursed = items[0].net_payout if items else 0.0
    last_date = items[0].created_at if items else None

    # Calculate pending approved timesheets not yet disbursed
    paid_timesheet_ids = {item.timesheet_id for item in items if item.timesheet_id}
    approved_sheets = (
        db.query(Timesheet)
        .join(Assignment)
        .filter(
            Assignment.contractor_id == current.contractor_id,
            Timesheet.status == TimesheetStatus.APPROVED,
        )
        .all()
    )
    pending_payout = 0.0
    for ts in approved_sheets:
        if ts.id not in paid_timesheet_ids:
            hours = sum(e.total_hours for e in ts.entries)
            rate = ts.assignment.pay_rate if ts.assignment else 0.0
            pending_payout += hours * rate

    currency = items[0].currency if items else "INR"

    return ContractorPayrollSummaryOut(
        lifetime_earnings=round(lifetime_earnings, 2),
        pending_payout=round(pending_payout, 2),
        last_disbursed_amount=round(last_disbursed, 2),
        last_disbursed_date=last_date,
        total_paid_slips=total_slips,
        currency=currency,
    )


@router.get("/contractor/pay-slips", response_model=List[PayrollItemOut])
def list_contractor_pay_slips(
    current: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    return (
        db.query(PayrollItem)
        .filter(PayrollItem.contractor_id == current.contractor_id)
        .order_by(PayrollItem.period_start.desc())
        .all()
    )


@router.get("/contractor/pay-slips/{pay_slip_id}", response_model=PayrollItemOut)
def get_pay_slip_detail(
    pay_slip_id: str,
    current: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    slip = (
        db.query(PayrollItem)
        .filter(PayrollItem.id == pay_slip_id, PayrollItem.contractor_id == current.contractor_id)
        .first()
    )
    if not slip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pay slip not found.")
    return slip
