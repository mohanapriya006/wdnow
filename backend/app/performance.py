"""Contractor performance scoring.

A transparent, weighted model built only from records already in the database:
weekly reports, their approval outcomes, logged hours, submission timestamps
and (where the contractor's project has them) milestone delivery.

The score is an analytical KPI. It never changes the contractual hourly rate on
an assignment - `simulate_performance_value` exists purely so the UI can show a
"what a performance-linked rate would look like" figure alongside the real one.

Components whose source data does not exist for a contractor are dropped and
the remaining weights are renormalised, so a brand-new contractor is not punished
for metrics the platform cannot yet measure.
"""
from __future__ import annotations

from datetime import date, datetime
from statistics import pstdev
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import (
    Assignment,
    Milestone,
    MilestoneStatus,
    Timesheet,
    TimesheetStatus,
)

#: Nominal weights. Renormalised across whichever components have data.
WEIGHTS = {
    "work_completion": 0.30,
    "report_accuracy": 0.20,
    "timeliness": 0.20,
    "hour_consistency": 0.15,
    "approval_history": 0.15,
}

COMPONENT_LABELS = {
    "work_completion": "Work completion",
    "report_accuracy": "Timesheet / report accuracy",
    "timeliness": "Timeliness of submission",
    "hour_consistency": "Working-hour consistency",
    "approval_history": "Approval vs rejection history",
    "milestone_delivery": "Milestone delivery",
}

#: A week submitted this many days after it closes scores zero for timeliness.
LATE_SUBMISSION_GRACE_DAYS = 7

#: Simulation band. A perfect score models +10%, a zero score -10%.
SIMULATION_SWING = 0.10


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def _band(score: float) -> str:
    if score >= 85:
        return "EXCELLENT"
    if score >= 70:
        return "STRONG"
    if score >= 50:
        return "FAIR"
    return "NEEDS_ATTENTION"


def _component(key: str, value: Optional[float], detail: str) -> dict:
    """One scored dimension. ``value`` of None means "no data, skip"."""
    return {
        "key": key,
        "label": COMPONENT_LABELS[key],
        "weight": WEIGHTS.get(key, 0.0),
        "value": None if value is None else round(_clamp(value) * 100, 1),
        "detail": detail,
    }


# ---------------------------------------------------------------------------
# Individual components
# ---------------------------------------------------------------------------

def _work_completion(sheets: List[Timesheet], assignment: Optional[Assignment]) -> dict:
    """Share of the assignment's elapsed weeks that carry a submitted report."""
    if not assignment:
        return _component("work_completion", None, "No assignment on record.")
    start = assignment.start_date
    end = min(assignment.end_date or date.today(), date.today())
    if end < start:
        return _component("work_completion", None, "Assignment has not started.")
    elapsed_weeks = max(((end - start).days // 7) + 1, 1)
    reported = len({s.week_start for s in sheets if s.status != TimesheetStatus.DRAFT})
    return _component(
        "work_completion",
        reported / elapsed_weeks,
        f"{reported} of {elapsed_weeks} elapsed week(s) reported.",
    )


def _report_accuracy(sheets: List[Timesheet]) -> dict:
    """Share of submitted weeks that carried no detected anomaly."""
    submitted = [s for s in sheets if s.status != TimesheetStatus.DRAFT]
    if not submitted:
        return _component("report_accuracy", None, "No submitted reports yet.")
    clean = len([s for s in submitted if not s.has_anomalies])
    return _component(
        "report_accuracy",
        clean / len(submitted),
        f"{clean} of {len(submitted)} report(s) submitted without anomalies.",
    )


def _timeliness(sheets: List[Timesheet]) -> dict:
    """How promptly weeks are submitted once the week closes."""
    dated = [s for s in sheets if s.submitted_at]
    if not dated:
        return _component("timeliness", None, "No submissions to measure.")
    scores, late = [], 0
    for sheet in dated:
        delay = (sheet.submitted_at.date() - sheet.week_end).days
        if delay > 0:
            late += 1
        scores.append(_clamp(1 - max(delay, 0) / LATE_SUBMISSION_GRACE_DAYS))
    return _component(
        "timeliness",
        sum(scores) / len(scores),
        f"{len(dated) - late} of {len(dated)} report(s) submitted by the week close.",
    )


def _hour_consistency(sheets: List[Timesheet], assignment: Optional[Assignment]) -> dict:
    """How steady weekly hours are against the assignment's configured week."""
    weekly = [
        round(sum(e.total_hours or 0 for e in s.entries), 2)
        for s in sheets
        if s.status != TimesheetStatus.DRAFT and s.entries
    ]
    if len(weekly) < 2:
        return _component("hour_consistency", None, "Needs at least two reported weeks.")
    capacity = float(assignment.working_hours or 40) if assignment else 40.0
    spread = pstdev(weekly)
    return _component(
        "hour_consistency",
        1 - (spread / capacity),
        f"Weekly hours vary by {spread:.1f}h against a {capacity:g}h week.",
    )


def _approval_history(sheets: List[Timesheet]) -> dict:
    """Approved share of everything the vendor has actually ruled on."""
    approved = len([s for s in sheets if s.status == TimesheetStatus.APPROVED])
    rejected = len([
        s for s in sheets if s.status in (TimesheetStatus.REJECTED, TimesheetStatus.FLAGGED)
    ])
    decided = approved + rejected
    if not decided:
        return _component("approval_history", None, "Nothing reviewed yet.")
    return _component(
        "approval_history",
        approved / decided,
        f"{approved} approved, {rejected} rejected out of {decided} reviewed.",
    )


def _milestone_delivery(db: Session, assignment: Optional[Assignment]) -> dict:
    """On-time delivery of the milestones on the contractor's project.

    Only included when the assigned project actually defines milestones, and
    carried at a small fixed weight since it is a project-level signal rather
    than a purely individual one.
    """
    if not assignment or not assignment.project_id:
        return _component("milestone_delivery", None, "No project milestones.")
    milestones = db.query(Milestone).filter(Milestone.project_id == assignment.project_id).all()
    resolved = [
        m for m in milestones
        if m.status in (MilestoneStatus.COMPLETED, MilestoneStatus.DELAYED)
        or m.due_date < date.today()
    ]
    if not resolved:
        return _component("milestone_delivery", None, "No milestones are due yet.")
    on_time = len([
        m for m in resolved
        if m.status == MilestoneStatus.COMPLETED
        and (m.completed_at is None or m.completed_at <= m.due_date)
    ])
    return _component(
        "milestone_delivery",
        on_time / len(resolved),
        f"{on_time} of {len(resolved)} due milestone(s) delivered on time.",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_performance(db: Session, contractor_id: str) -> dict:
    """Score one contractor from their stored records.

    Returns the overall score, its band, and every component with the weight
    actually applied after renormalisation - so the number is auditable.
    """
    assignment = (
        db.query(Assignment)
        .filter(Assignment.contractor_id == contractor_id)
        .order_by(Assignment.created_at.desc())
        .first()
    )
    sheets = (
        db.query(Timesheet).join(Assignment)
        .filter(Assignment.contractor_id == contractor_id)
        .all()
    )

    components = [
        _work_completion(sheets, assignment),
        _report_accuracy(sheets),
        _timeliness(sheets),
        _hour_consistency(sheets, assignment),
        _approval_history(sheets),
        _milestone_delivery(db, assignment),
    ]

    # Milestone delivery only participates when it has data; it borrows a small
    # slice rather than displacing the five primary dimensions.
    scored = [c for c in components if c["value"] is not None]
    if not scored:
        for c in components:
            c["applied_weight"] = 0.0
        return {
            "contractor_id": contractor_id,
            "score": None,
            "band": "NO_DATA",
            "components": components,
            "reports_considered": len(sheets),
            "calculated_at": datetime.utcnow(),
        }

    weights = {c["key"]: WEIGHTS.get(c["key"], 0.10) for c in scored}
    total_weight = sum(weights.values())
    score = sum(c["value"] * weights[c["key"]] for c in scored) / total_weight

    for c in components:
        c["applied_weight"] = (
            round(weights[c["key"]] / total_weight, 4) if c["value"] is not None else 0.0
        )

    return {
        "contractor_id": contractor_id,
        "score": round(score, 1),
        "band": _band(score),
        "components": components,
        "reports_considered": len(sheets),
        "calculated_at": datetime.utcnow(),
    }


def simulate_performance_value(gross_amount: float, score: Optional[float]) -> Optional[float]:
    """Analytical only: what the gross would be if pay tracked performance.

    Never written back to Assignment.pay_rate and never used to compute
    net_payable - it exists so the UI can put a simulated figure next to the
    contractual one.
    """
    if score is None or gross_amount <= 0:
        return None
    factor = 1 + ((score - 50) / 50) * SIMULATION_SWING
    return round(gross_amount * factor, 2)
