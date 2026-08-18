"""Vendor milestone analytics.

Aggregates the existing Milestone / Project / Assignment / TimeEntry records
into the delivery picture a vendor programme manager needs: progress per
project, overdue and at-risk counts, planned-versus-actual delivery, upcoming
deadlines and recent activity.

Read-only and vendor-only. Milestones are a vendor planning artefact and are
not exposed to workers anywhere in the API.
"""
from datetime import date, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_vendor
from app.models import (
    Assignment,
    AssignmentStatus,
    Milestone,
    MilestoneStatus,
    Project,
    TimeEntry,
)
from app.schemas import (
    MilestoneDashboardOut,
    MilestoneRowOut,
    ProjectMilestoneProgressOut,
)

router = APIRouter(prefix="/api/milestones", tags=["milestones"])

#: A milestone due within this window that has not started yet is "at risk".
AT_RISK_WINDOW_DAYS = 7

#: How far ahead the "upcoming deadlines" panel looks.
UPCOMING_WINDOW_DAYS = 30


def _risk(milestone: Milestone, today: date) -> str:
    """Traffic light derived purely from status and dates."""
    if milestone.status == MilestoneStatus.COMPLETED:
        return "COMPLETE"
    if milestone.due_date < today:
        return "OVERDUE"
    if milestone.status == MilestoneStatus.DELAYED:
        return "AT_RISK"
    days_left = (milestone.due_date - today).days
    if days_left <= AT_RISK_WINDOW_DAYS and milestone.status == MilestoneStatus.UPCOMING:
        # Due within the window but work has not started.
        return "AT_RISK"
    return "ON_TRACK"


def _variance(milestone: Milestone) -> Optional[int]:
    """Days late (positive) or early (negative). None while still open."""
    if milestone.status != MilestoneStatus.COMPLETED or not milestone.completed_at:
        return None
    return (milestone.completed_at - milestone.due_date).days


def _row(
    milestone: Milestone,
    project: Project,
    today: date,
    contractors: Dict[str, List[str]],
    hours: Dict[str, float],
) -> MilestoneRowOut:
    return MilestoneRowOut(
        id=milestone.id, project_id=project.id, project_name=project.name,
        name=milestone.name, description=milestone.description,
        start_date=milestone.start_date, due_date=milestone.due_date,
        completed_at=milestone.completed_at, priority=milestone.priority,
        status=milestone.status,
        variance_days=_variance(milestone),
        days_to_due=(milestone.due_date - today).days,
        is_overdue=milestone.due_date < today and milestone.status != MilestoneStatus.COMPLETED,
        risk=_risk(milestone, today),
        assigned_contractors=contractors.get(project.id, []),
        logged_hours=round(hours.get(milestone.id, 0.0), 2),
    )


@router.get("/vendor/dashboard", response_model=MilestoneDashboardOut)
def dashboard(
    project_id: Optional[str] = Query(default=None),
    status: Optional[MilestoneStatus] = Query(default=None),
    risk: Optional[str] = Query(default=None, description="ON_TRACK | AT_RISK | OVERDUE | COMPLETE"),
    q: Optional[str] = Query(default=None, description="Milestone or project name"),
    current: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Delivery analytics across every project this vendor owns.

    Filters narrow the milestone table and the deadline/activity panels; the
    per-project progress cards always reflect the full picture so the headline
    percentages do not move as the user filters.
    """
    today = date.today()
    projects = db.query(Project).filter(Project.vendor_id == current.vendor_id).all()
    project_ids = [p.id for p in projects]
    if not project_ids:
        return MilestoneDashboardOut()

    milestones = (
        db.query(Milestone)
        .filter(Milestone.project_id.in_(project_ids))
        .order_by(Milestone.due_date)
        .all()
    )

    # Who is on each project, and how much time has been logged per milestone.
    contractors: Dict[str, List[str]] = {}
    for assignment in db.query(Assignment).filter(
        Assignment.project_id.in_(project_ids), Assignment.status == AssignmentStatus.ACTIVE
    ).all():
        contractors.setdefault(assignment.project_id, []).append(
            assignment.contractor.name if assignment.contractor else assignment.contractor_id
        )

    hours: Dict[str, float] = {}
    milestone_ids = [m.id for m in milestones]
    if milestone_ids:
        for entry in db.query(TimeEntry).filter(TimeEntry.milestone_id.in_(milestone_ids)).all():
            hours[entry.milestone_id] = hours.get(entry.milestone_id, 0.0) + float(entry.total_hours or 0)

    by_project = {p.id: p for p in projects}
    rows = [_row(m, by_project[m.project_id], today, contractors, hours) for m in milestones]

    # ---- per-project progress (always unfiltered) ------------------------
    progress: List[ProjectMilestoneProgressOut] = []
    for project in projects:
        owned = [r for r in rows if r.project_id == project.id]
        completed = [r for r in owned if r.status == MilestoneStatus.COMPLETED]
        overdue = [r for r in owned if r.is_overdue]
        at_risk = [r for r in owned if r.risk == "AT_RISK"]
        variances = [r.variance_days for r in completed if r.variance_days is not None]
        open_due = [r.due_date for r in owned if r.status != MilestoneStatus.COMPLETED]
        progress.append(ProjectMilestoneProgressOut(
            project_id=project.id, project_name=project.name, project_status=project.status,
            start_date=project.start_date, end_date=project.end_date,
            total_milestones=len(owned), completed=len(completed),
            in_progress=len([r for r in owned if r.status == MilestoneStatus.IN_PROGRESS]),
            upcoming=len([r for r in owned if r.status == MilestoneStatus.UPCOMING]),
            overdue=len(overdue), at_risk=len(at_risk),
            completion_percent=round(len(completed) / len(owned) * 100, 1) if owned else 0.0,
            on_time_percent=(
                round(len([v for v in variances if v <= 0]) / len(variances) * 100, 1)
                if variances else None
            ),
            avg_variance_days=round(sum(variances) / len(variances), 1) if variances else None,
            assigned_contractors=len(contractors.get(project.id, [])),
            next_due=min(open_due) if open_due else None,
            risk="OVERDUE" if overdue else ("AT_RISK" if at_risk else "ON_TRACK"),
        ))

    # ---- filtered table --------------------------------------------------
    filtered = rows
    if project_id:
        filtered = [r for r in filtered if r.project_id == project_id]
    if status:
        filtered = [r for r in filtered if r.status == status]
    if risk:
        filtered = [r for r in filtered if r.risk == risk.upper()]
    if q:
        term = q.strip().lower()
        filtered = [
            r for r in filtered
            if term in r.name.lower() or term in r.project_name.lower()
        ]

    all_completed = [r for r in rows if r.status == MilestoneStatus.COMPLETED]
    all_variances = [r.variance_days for r in all_completed if r.variance_days is not None]
    horizon = today + timedelta(days=UPCOMING_WINDOW_DAYS)

    return MilestoneDashboardOut(
        total_projects=len([p for p in progress if p.total_milestones]),
        total_milestones=len(rows),
        completed=len(all_completed),
        in_progress=len([r for r in rows if r.status == MilestoneStatus.IN_PROGRESS]),
        upcoming=len([r for r in rows if r.status == MilestoneStatus.UPCOMING]),
        overdue=len([r for r in rows if r.is_overdue]),
        at_risk=len([r for r in rows if r.risk == "AT_RISK"]),
        completion_percent=round(len(all_completed) / len(rows) * 100, 1) if rows else 0.0,
        on_time_percent=(
            round(len([v for v in all_variances if v <= 0]) / len(all_variances) * 100, 1)
            if all_variances else None
        ),
        projects=sorted(progress, key=lambda p: (-p.overdue, -p.at_risk, p.project_name)),
        upcoming_deadlines=sorted(
            [
                r for r in filtered
                if r.status != MilestoneStatus.COMPLETED and today <= r.due_date <= horizon
            ],
            key=lambda r: r.due_date,
        )[:8],
        recent_activity=sorted(
            [r for r in filtered if r.completed_at is not None],
            key=lambda r: r.completed_at, reverse=True,
        )[:8],
        milestones=sorted(filtered, key=lambda r: (r.status == MilestoneStatus.COMPLETED, r.due_date)),
    )
