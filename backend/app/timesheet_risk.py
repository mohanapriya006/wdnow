"""Contractor timesheet risk analysis.

Sits on top of the existing rule engine and answers one question the per-sheet
rules cannot: what does this contractor's calendar day look like across ALL of
their assignments? A single weekly timesheet only ever sees its own assignment,
so more-than-24-hour days and cross-project overlaps are invisible to it.

Everything here is deterministic. It reads stored time entries, applies the pure
functions in app.timesheet_rules, and writes the findings back onto the
timesheet. No language model is involved in detection - the AI layer only
explains what this module has already decided.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Dict, Iterable, List, Optional, Sequence

from sqlalchemy.orm import Session

from app.models import Assignment, TimeEntry, Timesheet
from app import timesheet_rules as rules


# ---------------------------------------------------------------------------
# Gathering
# ---------------------------------------------------------------------------

def _entry_row(entry: TimeEntry, assignment: Assignment) -> dict:
    """Flatten one stored entry into the plain dict the rules expect."""
    return {
        "entry_id": entry.id,
        "timesheet_id": entry.timesheet_id,
        "assignment_id": assignment.id,
        "project": assignment.project_name,
        "role": assignment.role,
        "start": entry.start_at,
        "end": entry.end_at,
        "start_time": entry.clock_in,
        "end_time": entry.clock_out,
        "hours": float(entry.total_hours or 0),
        "configured_week": float(assignment.working_hours or 40),
    }


def contractor_day_entries(
    db: Session, contractor_id: str, days: Sequence[date]
) -> Dict[date, List[dict]]:
    """Every time entry this contractor logged on the given dates.

    Spans all of their assignments and timesheets, which is exactly what the
    per-assignment rules cannot see. Assignment status is ignored on purpose:
    a completed assignment's hours still occupy the same calendar day.
    """
    if not days:
        return {}
    rows = (
        db.query(TimeEntry, Assignment)
        .join(Timesheet, TimeEntry.timesheet_id == Timesheet.id)
        .join(Assignment, Timesheet.assignment_id == Assignment.id)
        .filter(Assignment.contractor_id == contractor_id, TimeEntry.work_date.in_(list(days)))
        .all()
    )
    grouped: Dict[date, List[dict]] = {d: [] for d in days}
    for entry, assignment in rows:
        grouped.setdefault(entry.work_date, []).append(_entry_row(entry, assignment))
    for bucket in grouped.values():
        bucket.sort(key=lambda r: (r["start"] or datetime.min, r["project"]))
    return grouped


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

def analyse_days(
    db: Session, contractor_id: str, days: Sequence[date]
) -> tuple[List[dict], List[dict]]:
    """Run the cross-assignment rules over a contractor's calendar days.

    Returns ``(anomalies, day_profiles)``. The profiles carry the assignment
    timelines and overlap pairs the vendor review screen draws.
    """
    grouped = contractor_day_entries(db, contractor_id, days)
    anomalies: List[dict] = []
    profiles: List[dict] = []

    for day in sorted(grouped):
        day_entries = grouped[day]
        if not day_entries:
            continue

        findings = rules.detect_calendar_day_conflicts(day, day_entries)
        anomalies.extend(findings)

        projects = sorted({e["project"] for e in day_entries})
        reported = round(sum(e["hours"] for e in day_entries), 2)

        # Only days that actually span more than one assignment are worth
        # rendering as a conflict timeline; a normal single-project day is not.
        profiles.append({
            "date": day.isoformat(),
            "reported_hours": reported,
            "maximum_hours": rules.MAX_CALENDAR_DAY_HOURS,
            "projects": projects,
            "multi_project": len({e["assignment_id"] for e in day_entries}) > 1,
            "entries": [
                {
                    "entry_id": e["entry_id"],
                    "assignment_id": e["assignment_id"],
                    "project": e["project"],
                    "start": e["start_time"],
                    "end": e["end_time"],
                    "hours": round(e["hours"], 2),
                }
                for e in day_entries
            ],
            "overlaps": [
                {
                    "overlap_hours": f.get("overlap_hours", 0),
                    "assignments": f.get("assignments", []),
                }
                for f in findings
                if f["type"] in ("OVERLAPPING_ASSIGNMENTS", "DUPLICATE_TIME_ENTRY")
            ],
        })

    return anomalies, profiles


def _assignment_limit_findings(sheet: Timesheet) -> List[dict]:
    """Weekly hours on this timesheet's own assignment vs its configured week."""
    assignment = sheet.assignment
    if assignment is None:
        return []
    logged = round(sum(float(e.total_hours or 0) for e in sheet.entries), 2)
    finding = rules.detect_assignment_limit(
        day=sheet.week_start,
        project=assignment.project_name,
        assignment_id=assignment.id,
        logged_hours=logged,
        configured_hours=float(assignment.working_hours or 0),
    )
    return [finding] if finding else []


def evaluate_sheet_risk(db: Session, sheet: Timesheet) -> List[dict]:
    """Recompute and store the cross-assignment findings for one timesheet.

    Writes ``cross_anomalies`` and folds the result into the aggregate flags the
    vendor list filters on. The caller owns the transaction.
    """
    days = sorted({e.work_date for e in sheet.entries})
    cross, _ = analyse_days(db, sheet.assignment.contractor_id, days) if days else ([], [])
    cross.extend(_assignment_limit_findings(sheet))

    sheet.cross_anomalies = json.dumps(cross) if cross else None

    own = rules.load_anomalies(sheet.week_anomalies) + [
        f for e in sheet.entries for f in rules.load_anomalies(e.anomaly_details)
    ]
    combined = own + cross
    sheet.has_anomalies = 1 if combined else 0
    sheet.anomaly_count = len(combined)
    sheet.anomaly_severity = _worst(combined)
    return cross


def refresh_contractor_risk(
    db: Session, contractor_id: str, days: Iterable[date]
) -> None:
    """Re-run risk for every timesheet of this contractor touching these days.

    Adding an entry on assignment B changes assignment A's picture of the same
    calendar day, so the sibling timesheets must be re-evaluated too - otherwise
    only one of two conflicting weeks would show the flag.
    """
    days = sorted(set(days))
    if not days:
        return
    siblings = (
        db.query(Timesheet)
        .join(Assignment, Timesheet.assignment_id == Assignment.id)
        .filter(
            Assignment.contractor_id == contractor_id,
            Timesheet.week_start <= max(days),
            Timesheet.week_end >= min(days),
        )
        .all()
    )
    for sheet in siblings:
        evaluate_sheet_risk(db, sheet)


def _worst(anomalies: List[dict]) -> Optional[str]:
    if not anomalies:
        return None
    return max(
        (a.get("severity", "LOW") for a in anomalies),
        key=lambda s: rules.SEVERITY_ORDER.get(s, 0),
    )


# ---------------------------------------------------------------------------
# Read models
# ---------------------------------------------------------------------------

def sheet_anomalies(sheet: Timesheet) -> List[dict]:
    """Every stored finding for a timesheet: per-entry, weekly, cross-assignment."""
    found = [f for e in sheet.entries for f in rules.load_anomalies(e.anomaly_details)]
    found.extend(rules.load_anomalies(sheet.week_anomalies))
    found.extend(rules.load_anomalies(sheet.cross_anomalies))
    return found


def risk_profile(db: Session, sheet: Timesheet) -> dict:
    """Full review payload for one timesheet: flags, evidence and timelines."""
    days = sorted({e.work_date for e in sheet.entries})
    _, profiles = analyse_days(db, sheet.assignment.contractor_id, days) if days else ([], [])
    anomalies = sheet_anomalies(sheet)
    return {
        "flag_status": rules.flag_status(anomalies),
        "severity": _worst(anomalies),
        "anomalies": anomalies,
        "days": profiles,
    }


def headline_reason(anomalies: List[dict]) -> Optional[str]:
    """One line the vendor can read without opening the timesheet."""
    if not anomalies:
        return None
    ranked = sorted(
        anomalies,
        key=lambda a: rules.SEVERITY_ORDER.get(a.get("severity", "LOW"), 0),
        reverse=True,
    )
    lead = ranked[0]["reason"]
    others = len(ranked) - 1
    if others:
        return f"{lead} {others} further finding(s) require review."
    return lead
