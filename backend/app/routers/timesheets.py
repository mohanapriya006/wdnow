"""Contractor -> Timesheet -> Vendor approval workflow.

Flow: the contractor logs start/end times for the day, the backend validates
and calculates the hours, stores them, aggregates them into the Monday-Sunday
weekly report, and runs anomaly detection. The contractor submits; the vendor
approves or rejects with a reason; the contractor sees the resulting status.

All hour arithmetic and every anomaly rule live in app.timesheet_rules, which
is the single source of truth. Approved hours stay on the row for downstream
invoice and payroll use.
"""
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_contractor, require_vendor
from app.models import (
    Assignment,
    AssignmentStatus,
    Project,
    Timesheet,
    TimeEntry,
    TimesheetAudit,
    TimesheetStatus,
)
from app.schemas import (
    ContractorTimesheetSummary,
    ProjectTimesheetAnalytics,
    TimeEntryCreate,
    TimeEntryOut,
    TimesheetOut,
    TimesheetReview,
    TimesheetSubmit,
)
from app import timesheet_rules as rules

router = APIRouter(prefix="/api/timesheets", tags=["timesheets"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

#: What the contractor and vendor see, derived from the stored status.
DISPLAY_STATUS = {
    TimesheetStatus.DRAFT: "DRAFT",
    TimesheetStatus.SUBMITTED: "PENDING",
    TimesheetStatus.FLAGGED: "REJECTED",  # legacy rows
    TimesheetStatus.APPROVED: "APPROVED",
    TimesheetStatus.REJECTED: "REJECTED",
}

#: Statuses a contractor may still edit. Submitted/approved weeks are locked.
EDITABLE = (TimesheetStatus.DRAFT, TimesheetStatus.REJECTED, TimesheetStatus.FLAGGED)


def week_of(day: date):
    """Kept for API compatibility with earlier callers."""
    return rules.week_bounds(day)


def audit(db: Session, sheet: Timesheet, role: str, action: str, detail: Optional[str] = None):
    db.add(TimesheetAudit(timesheet_id=sheet.id, actor_role=role, action=action, detail=detail))


def serialise(sheet: Timesheet) -> TimesheetOut:
    assignment = sheet.assignment
    capacity = int(assignment.working_hours or 40)

    entries = []
    entry_anomalies = []
    for e in sorted(sheet.entries, key=lambda x: (x.work_date, x.start_at or datetime.min)):
        found = rules.load_anomalies(e.anomaly_details)
        entry_anomalies.extend(found)
        holiday = rules.holiday_name(e.work_date)
        entries.append(TimeEntryOut(
            id=e.id, work_date=e.work_date, milestone_id=e.milestone_id,
            milestone_name=e.milestone.name if e.milestone else None,
            start_time=e.clock_in, end_time=e.clock_out,
            clock_in=e.clock_in, clock_out=e.clock_out,
            break_minutes=e.break_minutes, regular_hours=e.regular_hours,
            overtime_hours=e.overtime_hours, total_hours=e.total_hours,
            work_location=e.work_location, notes=e.notes,
            is_flagged=e.is_flagged, flag_reason=e.flag_reason,
            is_holiday=holiday is not None, holiday_name=holiday,
            has_anomaly=bool(e.has_anomaly), anomaly_severity=e.anomaly_severity,
            anomalies=found,
        ))

    # Weekly totals are always recomputed from the stored daily rows, so the
    # numbers on screen can never drift from what is in PostgreSQL.
    total = round(sum(e.total_hours for e in entries), 2)
    regular, overtime = rules.split_regular_overtime(total, capacity)
    anomalies = entry_anomalies + rules.load_anomalies(sheet.week_anomalies)

    return TimesheetOut(
        id=sheet.id, assignment_id=sheet.assignment_id, project_id=assignment.project_id,
        project_name=assignment.project_name, contractor_id=assignment.contractor_id,
        contractor_name=assignment.contractor.name,
        week_start=sheet.week_start, week_end=sheet.week_end, status=sheet.status,
        display_status=DISPLAY_STATUS.get(sheet.status, sheet.status.value),
        contractor_summary=sheet.contractor_summary, vendor_comment=sheet.vendor_comment,
        submitted_at=sheet.submitted_at, approved_at=sheet.approved_at,
        rejected_at=sheet.rejected_at, rejection_reason=sheet.rejection_reason,
        weekly_capacity=capacity, regular_hours=regular, overtime_hours=overtime,
        total_hours=total, compensation=round(total * assignment.pay_rate, 2),
        currency=assignment.currency, days_logged=len({e.work_date for e in entries}),
        has_anomalies=bool(anomalies), anomaly_count=len(anomalies),
        anomaly_severity=sheet.anomaly_severity, anomalies=anomalies, entries=entries,
        audit_history=[
            f"{a.created_at:%Y-%m-%d %H:%M} {a.actor_role}: {a.action}"
            f"{': ' + a.detail if a.detail else ''}"
            for a in sorted(sheet.audits, key=lambda a: a.created_at or datetime.min)
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
# Contractor
# ---------------------------------------------------------------------------

@router.get('/me', response_model=List[TimesheetOut])
def my_sheets(current: CurrentUser = Depends(require_contractor), db: Session = Depends(get_db)):
    sheets = (
        db.query(Timesheet).join(Assignment)
        .filter(Assignment.contractor_id == current.contractor_id)
        .order_by(Timesheet.week_start.desc()).all()
    )
    return [serialise(s) for s in sheets]


@router.post('/me/entries', response_model=TimesheetOut)
def log_entry(
    payload: TimeEntryCreate,
    current: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    """Record one day of work from a start and end time.

    Validation order: assignment -> week lock -> end after start -> plausible
    duration -> no duplicate/overlap. Only then is the row written and the week
    re-evaluated for anomalies.
    """
    assignment = active_assignment(db, current.contractor_id)
    if not assignment:
        raise HTTPException(status_code=409, detail='You must have an active assignment to log time.')

    start, end = rules.week_bounds(payload.work_date)
    sheet = db.query(Timesheet).filter(
        Timesheet.assignment_id == assignment.id, Timesheet.week_start == start
    ).first()
    if not sheet:
        sheet = Timesheet(
            vendor_id=assignment.vendor_id, assignment_id=assignment.id,
            week_start=start, week_end=end,
        )
        db.add(sheet)
        db.flush()
        audit(db, sheet, 'CONTRACTOR', 'WEEKLY_TIMESHEET_CREATED')
    if sheet.status not in EDITABLE:
        raise HTTPException(
            status_code=409,
            detail=f'This week is {DISPLAY_STATUS.get(sheet.status)} and can no longer be edited.',
        )

    start_raw = payload.start_time or payload.clock_in
    end_raw = payload.end_time or payload.clock_out
    if not start_raw:
        raise HTTPException(status_code=400, detail='Start time is required.')
    if not end_raw:
        raise HTTPException(status_code=400, detail='End time is required.')
    try:
        start_at = rules.to_timestamp(payload.work_date, rules.parse_hhmm(start_raw, 'Start time'))
        end_at = rules.to_timestamp(payload.work_date, rules.parse_hhmm(end_raw, 'End time'))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if end_at <= start_at:
        raise HTTPException(
            status_code=400,
            detail=f'End time ({end_raw}) must be after start time ({start_raw}).',
        )

    worked, total = rules.calculate_worked_hours(start_at, end_at, payload.break_minutes)
    if total <= 0:
        raise HTTPException(
            status_code=400,
            detail=f'A {payload.break_minutes} minute break leaves no payable time in a {worked:g}h day.',
        )
    if worked > rules.MAX_ENTRY_HOURS:
        raise HTTPException(status_code=400, detail='A single entry cannot exceed 24 hours.')

    try:
        rules.assert_no_conflict(start_at, end_at, payload.work_date, sheet.entries)
    except rules.TimeEntryConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    entry = TimeEntry(
        timesheet_id=sheet.id, work_date=payload.work_date,
        clock_in=f'{start_at:%H:%M}', clock_out=f'{end_at:%H:%M}',
        start_at=start_at, end_at=end_at, break_minutes=payload.break_minutes,
        worked_hours=worked, total_hours=total, regular_hours=total, overtime_hours=0,
        work_location=payload.work_location, notes=payload.notes,
    )
    db.add(entry)

    # A rejected week goes back to DRAFT as soon as the contractor edits it.
    if sheet.status in (TimesheetStatus.REJECTED, TimesheetStatus.FLAGGED):
        sheet.status = TimesheetStatus.DRAFT

    db.flush()
    db.expire(sheet, ['entries'])
    rules.evaluate_timesheet(sheet)
    audit(db, sheet, 'CONTRACTOR', 'DAILY_ENTRY_SAVED',
          f'{payload.work_date} {start_at:%H:%M}-{end_at:%H:%M} = {total:g}h')
    db.commit()
    db.refresh(sheet)
    return serialise(sheet)


@router.delete('/me/entries/{entry_id}', response_model=TimesheetOut)
def delete_entry(
    entry_id: str,
    current: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    """Remove a day entry so a mistake can be corrected and re-logged."""
    entry = (
        db.query(TimeEntry).join(Timesheet).join(Assignment)
        .filter(TimeEntry.id == entry_id, Assignment.contractor_id == current.contractor_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail='Time entry not found.')
    sheet = entry.timesheet
    if sheet.status not in EDITABLE:
        raise HTTPException(
            status_code=409,
            detail=f'This week is {DISPLAY_STATUS.get(sheet.status)} and can no longer be edited.',
        )
    audit(db, sheet, 'CONTRACTOR', 'DAILY_ENTRY_DELETED', str(entry.work_date))
    db.delete(entry)
    db.flush()
    db.expire(sheet, ['entries'])
    rules.evaluate_timesheet(sheet)
    db.commit()
    db.refresh(sheet)
    return serialise(sheet)


@router.post('/{sheet_id}/submit', response_model=TimesheetOut)
def submit(
    sheet_id: str,
    payload: TimesheetSubmit,
    current: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    """Submit the week for vendor review. Anomalies never block submission."""
    sheet = (
        db.query(Timesheet).join(Assignment)
        .filter(Timesheet.id == sheet_id, Assignment.contractor_id == current.contractor_id)
        .first()
    )
    if not sheet:
        raise HTTPException(status_code=404, detail='Timesheet not found.')
    if sheet.status == TimesheetStatus.APPROVED:
        raise HTTPException(status_code=409, detail='Approved timesheets are locked.')
    if sheet.status == TimesheetStatus.SUBMITTED:
        raise HTTPException(status_code=409, detail='This week is already awaiting vendor review.')
    if not sheet.entries:
        raise HTTPException(status_code=400, detail='Add daily entries before submitting.')

    rules.evaluate_timesheet(sheet)
    sheet.status = TimesheetStatus.SUBMITTED
    sheet.contractor_summary = payload.contractor_summary
    sheet.submitted_at = datetime.utcnow()
    sheet.rejection_reason = None
    sheet.rejected_at = None
    detail = f'{sheet.anomaly_count} anomaly(ies) detected' if sheet.has_anomalies else 'No anomalies'
    audit(db, sheet, 'CONTRACTOR', 'SUBMITTED', detail)
    db.commit()
    db.refresh(sheet)
    return serialise(sheet)


# ---------------------------------------------------------------------------
# Vendor: Timesheets -> Projects -> Contractor -> Weekly reports
# ---------------------------------------------------------------------------

@router.get('/vendor/projects', response_model=List[ProjectTimesheetAnalytics])
def project_analytics(current: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    result = []
    for p in db.query(Project).filter(Project.vendor_id == current.vendor_id).all():
        sheets = db.query(Timesheet).join(Assignment).filter(
            Assignment.vendor_id == current.vendor_id, Assignment.project_id == p.id
        ).all()
        entries = [e for s in sheets for e in s.entries]
        total = round(sum(e.total_hours for e in entries), 2)
        approved = round(
            sum(e.total_hours for s in sheets if s.status == TimesheetStatus.APPROVED for e in s.entries), 2
        )
        assigned = db.query(Assignment).filter(
            Assignment.project_id == p.id, Assignment.status == AssignmentStatus.ACTIVE
        ).count()
        submitted = len([s for s in sheets if s.status != TimesheetStatus.DRAFT])
        result.append(ProjectTimesheetAnalytics(
            project_id=p.id, project_name=p.name, total_contractors=assigned,
            total_hours=total,
            regular_hours=round(sum(e.regular_hours for e in entries), 2),
            overtime_hours=round(sum(e.overtime_hours for e in entries), 2),
            approved_hours=approved, pending_hours=round(total - approved, 2),
            labor_cost=round(sum(e.total_hours * s.assignment.pay_rate for s in sheets for e in s.entries), 2),
            utilization=round(total / (max(assigned, 1) * p.working_hours) * 100, 1),
            timesheet_compliance=round(submitted / max(len(sheets), 1) * 100, 1),
            anomaly_reports=len([s for s in sheets if s.has_anomalies and s.status != TimesheetStatus.DRAFT]),
            pending_reports=len([s for s in sheets if s.status == TimesheetStatus.SUBMITTED]),
        ))
    return result


@router.get('/vendor/projects/{project_id}/contractors', response_model=List[ContractorTimesheetSummary])
def project_contractors(
    project_id: str,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Contractors on a project, split by normal vs anomaly weekly reports."""
    assignments = db.query(Assignment).filter(
        Assignment.vendor_id == current.vendor_id, Assignment.project_id == project_id
    ).all()
    summaries = []
    for a in assignments:
        sheets = db.query(Timesheet).filter(Timesheet.assignment_id == a.id).all()
        reviewable = [s for s in sheets if s.status != TimesheetStatus.DRAFT]
        entries = [e for s in sheets for e in s.entries]
        submitted_at = [s.submitted_at for s in sheets if s.submitted_at]
        summaries.append(ContractorTimesheetSummary(
            contractor_id=a.contractor_id, contractor_name=a.contractor.name,
            assignment_id=a.id, role=a.role, weekly_capacity=int(a.working_hours or 40),
            total_weeks=len(sheets),
            normal_reports=len([s for s in reviewable if not s.has_anomalies]),
            anomaly_reports=len([s for s in reviewable if s.has_anomalies]),
            pending_reports=len([s for s in sheets if s.status == TimesheetStatus.SUBMITTED]),
            approved_reports=len([s for s in sheets if s.status == TimesheetStatus.APPROVED]),
            rejected_reports=len([
                s for s in sheets if s.status in (TimesheetStatus.REJECTED, TimesheetStatus.FLAGGED)
            ]),
            total_hours=round(sum(e.total_hours for e in entries), 2),
            approved_hours=round(sum(
                e.total_hours for s in sheets if s.status == TimesheetStatus.APPROVED for e in s.entries
            ), 2),
            last_submitted_at=max(submitted_at) if submitted_at else None,
        ))
    return sorted(summaries, key=lambda s: s.contractor_name)


@router.get('/vendor/projects/{project_id}', response_model=List[TimesheetOut])
def project_sheets(
    project_id: str,
    contractor_id: Optional[str] = Query(default=None),
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    query = db.query(Timesheet).join(Assignment).filter(
        Assignment.vendor_id == current.vendor_id, Assignment.project_id == project_id
    )
    if contractor_id:
        query = query.filter(Assignment.contractor_id == contractor_id)
    return [serialise(s) for s in query.order_by(Timesheet.week_start.desc()).all()]


@router.post('/vendor/{sheet_id}/review', response_model=TimesheetOut)
def review(
    sheet_id: str,
    payload: TimesheetReview,
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Approve or reject a submitted week. Rejection requires a reason."""
    sheet = db.query(Timesheet).filter(
        Timesheet.id == sheet_id, Timesheet.vendor_id == current.vendor_id
    ).first()
    if not sheet:
        raise HTTPException(status_code=404, detail='Timesheet not found.')
    if sheet.status == TimesheetStatus.APPROVED:
        raise HTTPException(status_code=409, detail='Approved timesheets are locked.')
    if sheet.status == TimesheetStatus.DRAFT:
        raise HTTPException(status_code=409, detail='This week has not been submitted yet.')

    reason = (payload.reason or payload.comment or '').strip()

    if payload.action == 'APPROVE':
        sheet.vendor_comment = reason or None
        sheet.status = TimesheetStatus.APPROVED
        sheet.approved_at = datetime.utcnow()
        sheet.rejected_at = None
        sheet.rejection_reason = None
        audit(db, sheet, 'VENDOR', 'APPROVED', reason or None)
    elif payload.action in ('REJECT', 'FLAG'):
        if not reason:
            raise HTTPException(status_code=400, detail='A rejection reason is required.')
        sheet.vendor_comment = reason
        sheet.rejection_reason = reason
        sheet.rejected_at = datetime.utcnow()
        sheet.status = TimesheetStatus.REJECTED
        # An optional entry_id pins the rejection to one specific day.
        if payload.entry_id:
            entry = db.query(TimeEntry).filter(
                TimeEntry.id == payload.entry_id, TimeEntry.timesheet_id == sheet.id
            ).first()
            if not entry:
                raise HTTPException(status_code=404, detail='Entry not found.')
            entry.is_flagged = 1
            entry.flag_reason = reason
        audit(db, sheet, 'VENDOR', 'REJECTED', reason)
    else:
        raise HTTPException(status_code=400, detail='Action must be APPROVE or REJECT.')

    db.commit()
    db.refresh(sheet)
    return serialise(sheet)
