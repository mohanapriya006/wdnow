from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import CurrentUser, require_contractor, require_vendor
from app.models import (
    Assignment,
    AssignmentStatus,
    Timesheet,
    TimeEntry,
    TimesheetAudit,
    TimesheetStatus,
    Milestone,
    Project,
)
from app.schemas import (
    TimeEntryCreate,
    TimeEntryOut,
    TimesheetOut,
    TimesheetSubmit,
    TimesheetReview,
    WeeklyTimesheetBatchCreate,
    VendorTimesheetSummaryOut,
    ProjectTimesheetAnalytics,
)

router = APIRouter(prefix="/api/timesheets", tags=["timesheets"])


def week_of(day: date):
    start = day - timedelta(days=day.weekday())
    return start, start + timedelta(days=6)


def audit(db: Session, sheet: Timesheet, role: str, action: str, detail: Optional[str] = None):
    db.add(TimesheetAudit(timesheet_id=sheet.id, actor_role=role, action=action, detail=detail))


def serialise(sheet: Timesheet) -> TimesheetOut:
    entries = [
        TimeEntryOut(
            id=e.id,
            work_date=e.work_date,
            milestone_id=e.milestone_id,
            milestone_name=e.milestone.name if e.milestone else None,
            clock_in=e.clock_in,
            clock_out=e.clock_out,
            break_minutes=e.break_minutes,
            regular_hours=e.regular_hours,
            overtime_hours=e.overtime_hours,
            total_hours=e.total_hours,
            work_location=e.work_location,
            notes=e.notes,
            is_flagged=e.is_flagged,
            flag_reason=e.flag_reason,
        )
        for e in sorted(sheet.entries, key=lambda x: x.work_date)
    ]
    
    regular = sum(e.regular_hours for e in sheet.entries)
    overtime = sum(e.overtime_hours for e in sheet.entries)
    total_hours = regular + overtime
    
    pay_rate = sheet.assignment.pay_rate if sheet.assignment else 0.0
    bill_rate = sheet.assignment.bill_rate if sheet.assignment else 0.0
    currency = sheet.assignment.currency if sheet.assignment else "INR"
    
    labor_cost = round(total_hours * pay_rate, 2)
    bill_amount = round(total_hours * bill_rate, 2)
    gross_margin = round(bill_amount - labor_cost, 2)
    gross_margin_pct = round((gross_margin / bill_amount * 100) if bill_amount > 0 else 0.0, 1)
    
    return TimesheetOut(
        id=sheet.id,
        assignment_id=sheet.assignment_id,
        project_id=sheet.assignment.project_id if sheet.assignment else None,
        project_name=sheet.assignment.project_name if sheet.assignment else "Assignment",
        contractor_id=sheet.assignment.contractor_id if sheet.assignment else None,
        contractor_name=sheet.assignment.contractor.name if (sheet.assignment and sheet.assignment.contractor) else "Contractor",
        week_start=sheet.week_start,
        week_end=sheet.week_end,
        status=sheet.status,
        contractor_summary=sheet.contractor_summary,
        vendor_comment=sheet.vendor_comment,
        submitted_at=sheet.submitted_at,
        approved_at=sheet.approved_at,
        regular_hours=round(regular, 2),
        overtime_hours=round(overtime, 2),
        total_hours=round(total_hours, 2),
        pay_rate=pay_rate,
        bill_rate=bill_rate,
        currency=currency,
        compensation=labor_cost,
        labor_cost=labor_cost,
        bill_amount=bill_amount,
        gross_margin=gross_margin,
        gross_margin_percent=gross_margin_pct,
        entries=entries,
        audit_history=[
            f"{a.created_at:%Y-%m-%d %H:%M} {a.actor_role}: {a.action}{': ' + a.detail if a.detail else ''}"
            for a in sheet.audits
        ],
    )


def active_assignment(db: Session, contractor_id: str) -> Optional[Assignment]:
    return (
        db.query(Assignment)
        .filter(Assignment.contractor_id == contractor_id, Assignment.status == AssignmentStatus.ACTIVE)
        .order_by(Assignment.created_at.desc())
        .first()
    )


# ---------------------------------------------------------------------------
# Contractor Endpoints
# ---------------------------------------------------------------------------

@router.get("/me", response_model=List[TimesheetOut])
def my_sheets(current: CurrentUser = Depends(require_contractor), db: Session = Depends(get_db)):
    """List all timesheets belonging to the logged-in contractor."""
    sheets = (
        db.query(Timesheet)
        .join(Assignment)
        .filter(Assignment.contractor_id == current.contractor_id)
        .order_by(Timesheet.week_start.desc())
        .all()
    )
    return [serialise(s) for s in sheets]


@router.post("/me/weekly-batch", response_model=TimesheetOut)
def save_weekly_timesheet(
    payload: WeeklyTimesheetBatchCreate,
    current: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    """
    Saves (or updates) an entire 7-day week timesheet at once.
    If submit_now is true, marks status as SUBMITTED immediately.
    """
    assignment = active_assignment(db, current.contractor_id)
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You must have an active assignment to log timesheets.",
        )

    start, end = week_of(payload.week_start)
    sheet = (
        db.query(Timesheet)
        .filter(Timesheet.assignment_id == assignment.id, Timesheet.week_start == start)
        .first()
    )

    if not sheet:
        sheet = Timesheet(
            vendor_id=assignment.vendor_id,
            assignment_id=assignment.id,
            week_start=start,
            week_end=end,
            status=TimesheetStatus.DRAFT,
        )
        db.add(sheet)
        db.flush()
        audit(db, sheet, "CONTRACTOR", "WEEKLY_TIMESHEET_CREATED")

    if sheet.status == TimesheetStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approved timesheets are locked and cannot be edited.",
        )

    # Process all daily entries in the batch
    for item in payload.entries:
        total_hours = item.hours
        if total_hours < 0 or total_hours > 24:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hours for {item.work_date} must be between 0 and 24.",
            )

        existing = (
            db.query(TimeEntry)
            .filter(TimeEntry.timesheet_id == sheet.id, TimeEntry.work_date == item.work_date)
            .first()
        )

        if total_hours == 0:
            if existing:
                db.delete(existing)
            continue

        regular = min(total_hours, 8.0)
        overtime = max(total_hours - 8.0, 0.0)

        if existing:
            existing.regular_hours = regular
            existing.overtime_hours = overtime
            existing.total_hours = total_hours
            existing.notes = item.notes
            existing.work_location = item.work_location
            existing.milestone_id = item.milestone_id
            existing.is_flagged = 0
            existing.flag_reason = None
        else:
            entry = TimeEntry(
                timesheet_id=sheet.id,
                milestone_id=item.milestone_id,
                work_date=item.work_date,
                regular_hours=regular,
                overtime_hours=overtime,
                total_hours=total_hours,
                work_location=item.work_location,
                notes=item.notes,
            )
            db.add(entry)

    if payload.contractor_summary is not None:
        sheet.contractor_summary = payload.contractor_summary

    if payload.submit_now:
        sheet.status = TimesheetStatus.SUBMITTED
        sheet.submitted_at = datetime.utcnow()
        audit(db, sheet, "CONTRACTOR", "WEEKLY_TIMESHEET_SUBMITTED", payload.contractor_summary)
    else:
        # If was flagged and contractor edited, move back to DRAFT
        if sheet.status == TimesheetStatus.FLAGGED:
            sheet.status = TimesheetStatus.DRAFT
        audit(db, sheet, "CONTRACTOR", "WEEKLY_DRAFT_SAVED")

    db.commit()
    db.refresh(sheet)
    return serialise(sheet)


@router.post("/me/entries", response_model=TimesheetOut)
def log_entry(
    payload: TimeEntryCreate,
    current: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    assignment = active_assignment(db, current.contractor_id)
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You must have an active assignment to log time.",
        )
    start, end = week_of(payload.work_date)
    sheet = (
        db.query(Timesheet)
        .filter(Timesheet.assignment_id == assignment.id, Timesheet.week_start == start)
        .first()
    )
    if not sheet:
        sheet = Timesheet(
            vendor_id=assignment.vendor_id,
            assignment_id=assignment.id,
            week_start=start,
            week_end=end,
        )
        db.add(sheet)
        db.flush()
        audit(db, sheet, "CONTRACTOR", "WEEKLY_TIMESHEET_CREATED")

    if sheet.status == TimesheetStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approved timesheets are locked.",
        )

    milestone = None
    if payload.milestone_id:
        milestone = (
            db.query(Milestone)
            .filter(Milestone.id == payload.milestone_id, Milestone.project_id == assignment.project_id)
            .first()
        )
        if not milestone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Milestone is not part of your assigned project.",
            )

    if payload.manual_hours is not None:
        total = payload.manual_hours
    elif payload.clock_in and payload.clock_out:
        try:
            a = datetime.strptime(payload.clock_in, "%H:%M")
            b = datetime.strptime(payload.clock_out, "%H:%M")
            total = (b - a).seconds / 3600 - payload.break_minutes / 60
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clock times must be HH:MM.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide manual hours or both clock-in and clock-out.",
        )

    if total < 0 or total > 24:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hours must be between 0 and 24.",
        )

    existing = (
        db.query(TimeEntry)
        .filter(TimeEntry.timesheet_id == sheet.id, TimeEntry.work_date == payload.work_date)
        .first()
    )
    if existing:
        db.delete(existing)

    if total > 0:
        entry = TimeEntry(
            timesheet_id=sheet.id,
            milestone_id=payload.milestone_id,
            work_date=payload.work_date,
            clock_in=payload.clock_in,
            clock_out=payload.clock_out,
            break_minutes=payload.break_minutes,
            regular_hours=min(total, 8.0),
            overtime_hours=max(total - 8.0, 0.0),
            total_hours=total,
            work_location=payload.work_location,
            notes=payload.notes,
        )
        db.add(entry)

    audit(db, sheet, "CONTRACTOR", "DAILY_ENTRY_SAVED", str(payload.work_date))
    db.commit()
    db.refresh(sheet)
    return serialise(sheet)


@router.post("/{sheet_id}/submit", response_model=TimesheetOut)
def submit(
    sheet_id: str,
    payload: TimesheetSubmit,
    current: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    sheet = (
        db.query(Timesheet)
        .join(Assignment)
        .filter(Timesheet.id == sheet_id, Assignment.contractor_id == current.contractor_id)
        .first()
    )
    if not sheet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timesheet not found.")
    if sheet.status == TimesheetStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approved timesheets are locked.",
        )
    if not sheet.entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add daily entries before submitting.",
        )
    sheet.status = TimesheetStatus.SUBMITTED
    sheet.contractor_summary = payload.contractor_summary
    sheet.submitted_at = datetime.utcnow()
    audit(db, sheet, "CONTRACTOR", "SUBMITTED", payload.contractor_summary)
    db.commit()
    db.refresh(sheet)
    return serialise(sheet)


# ---------------------------------------------------------------------------
# Vendor Endpoints
# ---------------------------------------------------------------------------

@router.get("/vendor/all", response_model=List[TimesheetOut])
def list_vendor_timesheets(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """
    Returns all timesheets across all contractors under this vendor.
    Optional query parameter: ?status=SUBMITTED | APPROVED | FLAGGED | DRAFT
    """
    query = (
        db.query(Timesheet)
        .join(Assignment)
        .filter(Assignment.vendor_id == current.vendor_id)
    )

    if status_filter and status_filter.upper() != "ALL":
        try:
            status_enum = TimesheetStatus(status_filter.upper())
            query = query.filter(Timesheet.status == status_enum)
        except ValueError:
            pass

    sheets = query.order_by(Timesheet.week_start.desc(), Timesheet.submitted_at.desc()).all()
    return [serialise(s) for s in sheets]


@router.get("/vendor/summary", response_model=VendorTimesheetSummaryOut)
def get_vendor_timesheet_summary(
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Returns top-level KPI metrics for vendor timesheets (pending review, margin, etc.)."""
    sheets = (
        db.query(Timesheet)
        .join(Assignment)
        .filter(Assignment.vendor_id == current.vendor_id)
        .all()
    )

    total_count = len(sheets)
    pending_count = sum(1 for s in sheets if s.status == TimesheetStatus.SUBMITTED)
    approved_count = sum(1 for s in sheets if s.status == TimesheetStatus.APPROVED)
    flagged_count = sum(1 for s in sheets if s.status == TimesheetStatus.FLAGGED)

    total_hours = 0.0
    total_labor = 0.0
    total_bill = 0.0

    for s in sheets:
        hrs = sum(e.total_hours for e in s.entries)
        pay = s.assignment.pay_rate if s.assignment else 0.0
        bill = s.assignment.bill_rate if s.assignment else 0.0
        total_hours += hrs
        total_labor += hrs * pay
        total_bill += hrs * bill

    currency = "INR"
    if sheets and sheets[0].assignment:
        currency = sheets[0].assignment.currency

    return VendorTimesheetSummaryOut(
        total_timesheets=total_count,
        pending_count=pending_count,
        approved_count=approved_count,
        flagged_count=flagged_count,
        total_hours=round(total_hours, 2),
        total_labor_cost=round(total_labor, 2),
        total_bill_amount=round(total_bill, 2),
        total_gross_margin=round(total_bill - total_labor, 2),
        currency=currency,
    )


@router.get("/vendor/projects", response_model=List[ProjectTimesheetAnalytics])
def project_analytics(current: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.vendor_id == current.vendor_id).all()
    result = []
    for p in projects:
        sheets = db.query(Timesheet).join(Assignment).filter(Assignment.project_id == p.id).all()
        entries = [e for s in sheets for e in s.entries]
        total = sum(e.total_hours for e in entries)
        regular = sum(e.regular_hours for e in entries)
        overtime = sum(e.overtime_hours for e in entries)
        assigned = (
            db.query(Assignment)
            .filter(Assignment.project_id == p.id, Assignment.status == AssignmentStatus.ACTIVE)
            .count()
        )
        approved = sum(
            e.total_hours for s in sheets if s.status == TimesheetStatus.APPROVED for e in s.entries
        )
        pending = total - approved
        submitted = len(
            [s for s in sheets if s.status in (TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED)]
        )
        result.append(
            ProjectTimesheetAnalytics(
                project_id=p.id,
                project_name=p.name,
                total_contractors=assigned,
                total_hours=round(total, 2),
                regular_hours=round(regular, 2),
                overtime_hours=round(overtime, 2),
                approved_hours=round(approved, 2),
                pending_hours=round(pending, 2),
                labor_cost=round(
                    sum(e.total_hours * s.assignment.pay_rate for s in sheets for e in s.entries), 2
                ),
                utilization=round(total / (max(assigned, 1) * p.working_hours) * 100, 1),
                timesheet_compliance=round(submitted / max(len(sheets), 1) * 100, 1),
            )
        )
    return result


@router.get("/vendor/projects/{project_id}", response_model=List[TimesheetOut])
def project_sheets(
    project_id: str,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    sheets = (
        db.query(Timesheet)
        .join(Assignment)
        .filter(Assignment.vendor_id == current.vendor_id, Assignment.project_id == project_id)
        .order_by(Timesheet.week_start.desc())
        .all()
    )
    return [serialise(s) for s in sheets]


@router.post("/vendor/{sheet_id}/review", response_model=TimesheetOut)
def review(
    sheet_id: str,
    payload: TimesheetReview,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    sheet = (
        db.query(Timesheet)
        .filter(Timesheet.id == sheet_id, Timesheet.vendor_id == current.vendor_id)
        .first()
    )
    if not sheet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timesheet not found.")
    if sheet.status == TimesheetStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approved timesheets are locked.",
        )

    sheet.vendor_comment = payload.comment
    if payload.action == "APPROVE":
        sheet.status = TimesheetStatus.APPROVED
        sheet.approved_at = datetime.utcnow()
        audit(db, sheet, "VENDOR", "APPROVED", payload.comment)
    else:
        sheet.status = TimesheetStatus.FLAGGED
        if payload.entry_id:
            entry = (
                db.query(TimeEntry)
                .filter(TimeEntry.id == payload.entry_id, TimeEntry.timesheet_id == sheet.id)
                .first()
            )
            if entry:
                entry.is_flagged = 1
                entry.flag_reason = payload.comment
        audit(db, sheet, "VENDOR", "REVISION_REQUESTED", payload.comment)

    db.commit()
    db.refresh(sheet)
    return serialise(sheet)
