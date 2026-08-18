from datetime import date, datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import CurrentUser, require_contractor, require_vendor
from app.models import Assignment, AssignmentStatus, Timesheet, TimeEntry, TimesheetAudit, TimesheetStatus, Milestone, Project
from app.schemas import TimeEntryCreate, TimeEntryOut, TimesheetOut, TimesheetSubmit, TimesheetReview, ProjectTimesheetAnalytics

router = APIRouter(prefix="/api/timesheets", tags=["timesheets"])

def week_of(day: date):
    start = day - timedelta(days=day.weekday()); return start, start + timedelta(days=6)

def audit(db, sheet, role, action, detail=None): db.add(TimesheetAudit(timesheet_id=sheet.id, actor_role=role, action=action, detail=detail))

def serialise(sheet: Timesheet) -> TimesheetOut:
    entries = [TimeEntryOut(id=e.id, work_date=e.work_date, milestone_id=e.milestone_id, milestone_name=e.milestone.name if e.milestone else None, clock_in=e.clock_in, clock_out=e.clock_out, break_minutes=e.break_minutes, regular_hours=e.regular_hours, overtime_hours=e.overtime_hours, total_hours=e.total_hours, work_location=e.work_location, notes=e.notes, is_flagged=e.is_flagged, flag_reason=e.flag_reason) for e in sheet.entries]
    regular=sum(e.regular_hours for e in sheet.entries); overtime=sum(e.overtime_hours for e in sheet.entries)
    return TimesheetOut(id=sheet.id, assignment_id=sheet.assignment_id, project_id=sheet.assignment.project_id, project_name=sheet.assignment.project_name, contractor_name=sheet.assignment.contractor.name, week_start=sheet.week_start, week_end=sheet.week_end, status=sheet.status, contractor_summary=sheet.contractor_summary, vendor_comment=sheet.vendor_comment, submitted_at=sheet.submitted_at, approved_at=sheet.approved_at, regular_hours=regular, overtime_hours=overtime, total_hours=regular+overtime, compensation=(regular+overtime)*sheet.assignment.pay_rate, entries=entries, audit_history=[f"{a.created_at:%Y-%m-%d %H:%M} {a.actor_role}: {a.action}{': '+a.detail if a.detail else ''}" for a in sheet.audits])

def active_assignment(db, contractor_id):
    return db.query(Assignment).filter(Assignment.contractor_id==contractor_id, Assignment.status==AssignmentStatus.ACTIVE).order_by(Assignment.created_at.desc()).first()

@router.get('/me', response_model=List[TimesheetOut])
def my_sheets(current: CurrentUser=Depends(require_contractor), db: Session=Depends(get_db)):
    return [serialise(s) for s in db.query(Timesheet).join(Assignment).filter(Assignment.contractor_id==current.contractor_id).order_by(Timesheet.week_start.desc()).all()]

@router.post('/me/entries', response_model=TimesheetOut)
def log_entry(payload: TimeEntryCreate, current: CurrentUser=Depends(require_contractor), db: Session=Depends(get_db)):
    assignment=active_assignment(db,current.contractor_id)
    if not assignment: raise HTTPException(status_code=409,detail='You must have an active assignment to log time.')
    start,end=week_of(payload.work_date)
    sheet=db.query(Timesheet).filter(Timesheet.assignment_id==assignment.id,Timesheet.week_start==start).first()
    if not sheet:
        sheet=Timesheet(vendor_id=assignment.vendor_id,assignment_id=assignment.id,week_start=start,week_end=end); db.add(sheet); db.flush(); audit(db,sheet,'CONTRACTOR','WEEKLY_TIMESHEET_CREATED')
    if sheet.status==TimesheetStatus.APPROVED: raise HTTPException(status_code=409,detail='Approved timesheets are locked.')
    milestone=None
    if payload.milestone_id:
        milestone=db.query(Milestone).filter(Milestone.id==payload.milestone_id,Milestone.project_id==assignment.project_id).first()
        if not milestone: raise HTTPException(status_code=400,detail='Milestone is not part of your assigned project.')
    if payload.manual_hours is not None: total=payload.manual_hours
    elif payload.clock_in and payload.clock_out:
        try:
            a=datetime.strptime(payload.clock_in,'%H:%M'); b=datetime.strptime(payload.clock_out,'%H:%M'); total=(b-a).seconds/3600-payload.break_minutes/60
        except ValueError: raise HTTPException(status_code=400,detail='Clock times must be HH:MM.')
    else: raise HTTPException(status_code=400,detail='Provide manual hours or both clock-in and clock-out.')
    if total<=0 or total>24: raise HTTPException(status_code=400,detail='Hours must be between 0 and 24.')
    existing=db.query(TimeEntry).filter(TimeEntry.timesheet_id==sheet.id,TimeEntry.work_date==payload.work_date).first()
    if existing: db.delete(existing)
    entry=TimeEntry(timesheet_id=sheet.id,milestone_id=payload.milestone_id,work_date=payload.work_date,clock_in=payload.clock_in,clock_out=payload.clock_out,break_minutes=payload.break_minutes,regular_hours=min(total,8),overtime_hours=max(total-8,0),total_hours=total,work_location=payload.work_location,notes=payload.notes)
    db.add(entry); audit(db,sheet,'CONTRACTOR','DAILY_ENTRY_SAVED',str(payload.work_date)); db.commit(); db.refresh(sheet); return serialise(sheet)

@router.post('/{sheet_id}/submit',response_model=TimesheetOut)
def submit(sheet_id:str,payload:TimesheetSubmit,current:CurrentUser=Depends(require_contractor),db:Session=Depends(get_db)):
    sheet=db.query(Timesheet).join(Assignment).filter(Timesheet.id==sheet_id,Assignment.contractor_id==current.contractor_id).first()
    if not sheet: raise HTTPException(status_code=404,detail='Timesheet not found.')
    if sheet.status==TimesheetStatus.APPROVED: raise HTTPException(status_code=409,detail='Approved timesheets are locked.')
    if not sheet.entries: raise HTTPException(status_code=400,detail='Add daily entries before submitting.')
    sheet.status=TimesheetStatus.SUBMITTED; sheet.contractor_summary=payload.contractor_summary; sheet.submitted_at=datetime.utcnow(); audit(db,sheet,'CONTRACTOR','SUBMITTED'); db.commit(); db.refresh(sheet); return serialise(sheet)

@router.get('/vendor/projects',response_model=List[ProjectTimesheetAnalytics])
def project_analytics(current:CurrentUser=Depends(require_vendor),db:Session=Depends(get_db)):
    projects=db.query(Project).filter(Project.vendor_id==current.vendor_id).all(); result=[]
    for p in projects:
        sheets=db.query(Timesheet).join(Assignment).filter(Assignment.project_id==p.id).all(); entries=[e for s in sheets for e in s.entries]; total=sum(e.total_hours for e in entries); regular=sum(e.regular_hours for e in entries); overtime=sum(e.overtime_hours for e in entries); assigned=db.query(Assignment).filter(Assignment.project_id==p.id,Assignment.status==AssignmentStatus.ACTIVE).count(); approved=sum(e.total_hours for s in sheets if s.status==TimesheetStatus.APPROVED for e in s.entries); pending=total-approved; submitted=len([s for s in sheets if s.status in (TimesheetStatus.SUBMITTED,TimesheetStatus.APPROVED)]); result.append(ProjectTimesheetAnalytics(project_id=p.id,project_name=p.name,total_contractors=assigned,total_hours=total,regular_hours=regular,overtime_hours=overtime,approved_hours=approved,pending_hours=pending,labor_cost=sum(e.total_hours*s.assignment.pay_rate for s in sheets for e in s.entries),utilization=round(total/(max(assigned,1)*p.working_hours)*100,1),timesheet_compliance=round(submitted/max(len(sheets),1)*100,1)))
    return result

@router.get('/vendor/projects/{project_id}',response_model=List[TimesheetOut])
def project_sheets(project_id:str,current:CurrentUser=Depends(require_vendor),db:Session=Depends(get_db)):
    sheets=db.query(Timesheet).join(Assignment).filter(Assignment.vendor_id==current.vendor_id,Assignment.project_id==project_id).order_by(Timesheet.week_start.desc()).all(); return [serialise(s) for s in sheets]

@router.post('/vendor/{sheet_id}/review',response_model=TimesheetOut)
def review(sheet_id:str,payload:TimesheetReview,current:CurrentUser=Depends(require_vendor),db:Session=Depends(get_db)):
    sheet=db.query(Timesheet).filter(Timesheet.id==sheet_id,Timesheet.vendor_id==current.vendor_id).first()
    if not sheet: raise HTTPException(status_code=404,detail='Timesheet not found.')
    if sheet.status==TimesheetStatus.APPROVED: raise HTTPException(status_code=409,detail='Approved timesheets are locked.')
    sheet.vendor_comment=payload.comment
    if payload.action=='APPROVE': sheet.status=TimesheetStatus.APPROVED; sheet.approved_at=datetime.utcnow(); audit(db,sheet,'VENDOR','APPROVED',payload.comment)
    else:
        if not payload.entry_id: raise HTTPException(status_code=400,detail='Choose an entry to flag.')
        entry=db.query(TimeEntry).filter(TimeEntry.id==payload.entry_id,TimeEntry.timesheet_id==sheet.id).first()
        if not entry: raise HTTPException(status_code=404,detail='Entry not found.')
        entry.is_flagged=1; entry.flag_reason=payload.comment; sheet.status=TimesheetStatus.FLAGGED; audit(db,sheet,'VENDOR','ENTRY_FLAGGED',payload.comment)
    db.commit(); db.refresh(sheet); return serialise(sheet)
