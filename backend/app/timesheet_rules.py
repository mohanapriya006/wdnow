"""Timesheet hour calculation and anomaly detection.

The backend is the single source of truth for worked hours, validation and
anomalies. The frontend only renders what this module produces, so a client
cannot talk the platform into accepting hours it would otherwise reject.

Nothing here writes to the database; callers persist the results. Keeping the
rules in one plain module (no new services or frameworks) means the same logic
runs for contractor entry, weekly aggregation and vendor review.
"""
from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from typing import Iterable, List, Optional

# ---------------------------------------------------------------------------
# Configuration
#
# These are the platform-wide time rules. Per-assignment weekly capacity comes
# from Assignment.working_hours (the existing working-hours configuration), so
# a 41h week against a 40h assignment yields 40 regular + 1 overtime.
# ---------------------------------------------------------------------------

#: A single entry may never exceed this. Anything longer is rejected outright.
MAX_ENTRY_HOURS = 24.0

#: A day longer than this is stored but raised as an "excessive hours" anomaly.
EXCESSIVE_DAILY_HOURS = 12.0

#: A day longer than this is treated as critical rather than merely high.
CRITICAL_DAILY_HOURS = 16.0

#: Weekly hours above this multiple of the assignment's configured week are
#: raised as an excessive-week anomaly (40h config -> flagged above 50h).
EXCESSIVE_WEEKLY_MULTIPLIER = 1.25

#: Overtime beyond this many hours in a week violates the configured time rule.
MAX_WEEKLY_OVERTIME_HOURS = 8.0

#: Entries starting before / ending after these are outside normal work hours.
NORMAL_WINDOW_START = time(6, 0)
NORMAL_WINDOW_END = time(22, 0)

#: Weekend days (Mon=0 ... Sun=6) treated as non-working days.
WEEKEND_DAYS = {5, 6}

#: Fixed public-holiday calendar, keyed by MM-DD. Kept as configuration in code
#: rather than a new table so the Timesheet module adds no unrelated schema.
PUBLIC_HOLIDAYS: dict[str, str] = {
    "01-01": "New Year",
    "01-26": "Republic Day",
    "05-01": "Labour Day",
    "08-15": "Independence Day",
    "10-02": "Gandhi Jayanti",
    "12-25": "Christmas Day",
}

SEVERITY_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


# ---------------------------------------------------------------------------
# Hour calculation
# ---------------------------------------------------------------------------

def parse_hhmm(value: Optional[str], label: str) -> time:
    """Parse an HH:MM clock string, raising ValueError with a clear message."""
    if not value:
        raise ValueError(f"{label} is required.")
    try:
        return datetime.strptime(value.strip(), "%H:%M").time()
    except ValueError:
        raise ValueError(f"{label} must be in HH:MM 24-hour format, for example 09:00.")


def to_timestamp(work_date: date, clock: time) -> datetime:
    return datetime.combine(work_date, clock)


def calculate_worked_hours(
    start_at: datetime, end_at: datetime, break_minutes: int = 0
) -> tuple[float, float]:
    """Return (worked_hours, payable_hours) for a start/end pair.

    ``worked_hours`` is the raw elapsed time between start and end. ``payable``
    subtracts the unpaid break and is what appears on the timesheet.
    """
    worked = (end_at - start_at).total_seconds() / 3600.0
    payable = worked - (break_minutes or 0) / 60.0
    return round(worked, 2), round(payable, 2)


def holiday_name(day: date) -> Optional[str]:
    """Name of the non-working day, or None if it is a regular working day."""
    fixed = PUBLIC_HOLIDAYS.get(day.strftime("%m-%d"))
    if fixed:
        return fixed
    if day.weekday() in WEEKEND_DAYS:
        return "Weekend"
    return None


def week_bounds(day: date) -> tuple[date, date]:
    """Monday-to-Sunday week containing ``day``, inclusive on both ends."""
    start = day - timedelta(days=day.weekday())
    return start, start + timedelta(days=6)


def split_regular_overtime(total_hours: float, weekly_capacity: float) -> tuple[float, float]:
    """Split a weekly total against the configured capacity: 41h -> 40 + 1."""
    regular = min(round(total_hours, 2), float(weekly_capacity))
    overtime = max(round(total_hours - weekly_capacity, 2), 0.0)
    return round(regular, 2), round(overtime, 2)


def allocate_week(entries: list, weekly_capacity: float) -> None:
    """Recompute each entry's regular/overtime share for the whole week.

    Hours are consumed chronologically: the earliest entries of the week fill
    the assignment's regular capacity and everything after it is overtime. This
    keeps the per-entry columns consistent with the weekly totals users see.
    """
    ordered = sorted(entries, key=lambda e: (e.work_date, e.start_at or datetime.min))
    remaining = float(weekly_capacity)
    for entry in ordered:
        hours = float(entry.total_hours or 0)
        regular = min(hours, max(remaining, 0.0))
        entry.regular_hours = round(regular, 2)
        entry.overtime_hours = round(hours - regular, 2)
        remaining -= regular


# ---------------------------------------------------------------------------
# Validation - hard failures raised before anything is stored
# ---------------------------------------------------------------------------

class TimeEntryConflict(Exception):
    """Raised when a new entry duplicates or overlaps one already stored."""


def assert_no_conflict(
    new_start: datetime, new_end: datetime, work_date: date, existing: Iterable
) -> None:
    """Reject exact duplicates and overlapping ranges on the same day.

    Anomaly detection still reports overlaps and duplicates that already exist
    in the database (legacy or imported rows); this guard only stops new ones
    from being created.
    """
    for entry in existing:
        if entry.work_date != work_date or entry.start_at is None or entry.end_at is None:
            continue
        if entry.start_at == new_start and entry.end_at == new_end:
            raise TimeEntryConflict(
                f"Duplicate entry: {work_date} "
                f"{new_start:%H:%M}-{new_end:%H:%M} is already logged."
            )
        if new_start < entry.end_at and entry.start_at < new_end:
            raise TimeEntryConflict(
                f"Overlapping entry: {work_date} {new_start:%H:%M}-{new_end:%H:%M} overlaps the "
                f"existing {entry.start_at:%H:%M}-{entry.end_at:%H:%M} entry."
            )


# ---------------------------------------------------------------------------
# Anomaly detection
# ---------------------------------------------------------------------------

def _anomaly(kind: str, severity: str, day: date, hours: float, reason: str) -> dict:
    return {
        "type": kind,
        "severity": severity,
        "date": day.isoformat(),
        "hours": round(float(hours or 0), 2),
        "reason": reason,
    }


def detect_entry_anomalies(entry, siblings: list) -> List[dict]:
    """Every anomaly attributable to one stored day entry."""
    found: List[dict] = []
    day = entry.work_date
    hours = float(entry.total_hours or 0)

    # Missing / invalid end time -------------------------------------------
    if entry.end_at is None and not entry.clock_out:
        found.append(_anomaly(
            "MISSING_END_TIME", "CRITICAL", day, hours,
            "No end time recorded for this day, so the hours cannot be verified.",
        ))
    elif entry.start_at is not None and entry.end_at is not None and entry.end_at <= entry.start_at:
        found.append(_anomaly(
            "INVALID_END_TIME", "CRITICAL", day, hours,
            f"End time {entry.end_at:%H:%M} is not after start time {entry.start_at:%H:%M}.",
        ))

    # Excessive hours -------------------------------------------------------
    if hours > CRITICAL_DAILY_HOURS:
        found.append(_anomaly(
            "EXCESSIVE_DAILY_HOURS", "CRITICAL", day, hours,
            f"{hours:g}h logged in a single day exceeds the "
            f"{CRITICAL_DAILY_HOURS:g}h critical limit.",
        ))
    elif hours > EXCESSIVE_DAILY_HOURS:
        found.append(_anomaly(
            "EXCESSIVE_DAILY_HOURS", "HIGH", day, hours,
            f"{hours:g}h logged in a single day exceeds the "
            f"{EXCESSIVE_DAILY_HOURS:g}h daily threshold.",
        ))

    # Holiday / weekend work ------------------------------------------------
    name = holiday_name(day)
    if name:
        found.append(_anomaly(
            "HOLIDAY_WORK", "MEDIUM", day, hours,
            f"{hours:g}h logged on {day:%a %d %b}, a non-working day ({name}).",
        ))

    # Duplicates and overlaps already present in the database ---------------
    for other in siblings:
        if other.id == entry.id or other.work_date != day:
            continue
        if None in (other.start_at, other.end_at, entry.start_at, entry.end_at):
            continue
        if other.start_at == entry.start_at and other.end_at == entry.end_at:
            if other.id > entry.id:  # report the pair once
                found.append(_anomaly(
                    "DUPLICATE_TIME_ENTRY", "HIGH", day, hours,
                    f"Two entries record the identical window "
                    f"{entry.start_at:%H:%M}-{entry.end_at:%H:%M}.",
                ))
        elif entry.start_at < other.end_at and other.start_at < entry.end_at:
            if other.id > entry.id:
                found.append(_anomaly(
                    "OVERLAPPING_ENTRY", "HIGH", day, hours,
                    f"{entry.start_at:%H:%M}-{entry.end_at:%H:%M} overlaps "
                    f"{other.start_at:%H:%M}-{other.end_at:%H:%M} on the same day.",
                ))

    # Configured time-rule violations ---------------------------------------
    if entry.start_at is not None and entry.start_at.time() < NORMAL_WINDOW_START:
        found.append(_anomaly(
            "TIME_RULE_VIOLATION", "MEDIUM", day, hours,
            f"Start time {entry.start_at:%H:%M} is before the "
            f"{NORMAL_WINDOW_START:%H:%M} working-window start.",
        ))
    if entry.end_at is not None and entry.end_at.time() > NORMAL_WINDOW_END:
        found.append(_anomaly(
            "TIME_RULE_VIOLATION", "MEDIUM", day, hours,
            f"End time {entry.end_at:%H:%M} is after the "
            f"{NORMAL_WINDOW_END:%H:%M} working-window end.",
        ))
    if hours <= 0:
        found.append(_anomaly(
            "TIME_RULE_VIOLATION", "HIGH", day, hours,
            "Entry resolves to zero payable hours once the break is deducted.",
        ))

    return found


def detect_week_anomalies(entries: list, weekly_capacity: float, week_start: date) -> List[dict]:
    """Anomalies that only exist at the weekly level."""
    found: List[dict] = []
    total = round(sum(float(e.total_hours or 0) for e in entries), 2)
    overtime = round(max(total - weekly_capacity, 0.0), 2)
    threshold = round(weekly_capacity * EXCESSIVE_WEEKLY_MULTIPLIER, 2)

    if total > threshold:
        found.append(_anomaly(
            "EXCESSIVE_WEEKLY_HOURS", "HIGH", week_start, total,
            f"{total:g}h logged this week exceeds the {threshold:g}h ceiling for a "
            f"{weekly_capacity:g}h assignment.",
        ))
    if overtime > MAX_WEEKLY_OVERTIME_HOURS:
        found.append(_anomaly(
            "TIME_RULE_VIOLATION", "MEDIUM", week_start, overtime,
            f"{overtime:g}h overtime exceeds the configured weekly maximum of "
            f"{MAX_WEEKLY_OVERTIME_HOURS:g}h.",
        ))
    return found


def evaluate_timesheet(sheet) -> List[dict]:
    """Run every rule over a stored timesheet and stamp the results onto it.

    Returns the full anomaly list; the caller commits. Anomalies never block a
    submission - the vendor reviews and decides.
    """
    entries = list(sheet.entries)
    capacity = float(sheet.assignment.working_hours or 40) if sheet.assignment else 40.0

    all_anomalies: List[dict] = []
    for entry in entries:
        entry_anomalies = detect_entry_anomalies(entry, entries)
        entry.has_anomaly = 1 if entry_anomalies else 0
        entry.anomaly_severity = _worst(entry_anomalies)
        entry.anomaly_details = json.dumps(entry_anomalies) if entry_anomalies else None
        all_anomalies.extend(entry_anomalies)

    week_anomalies = detect_week_anomalies(entries, capacity, sheet.week_start)
    all_anomalies.extend(week_anomalies)

    allocate_week(entries, capacity)

    sheet.has_anomalies = 1 if all_anomalies else 0
    sheet.anomaly_count = len(all_anomalies)
    sheet.anomaly_severity = _worst(all_anomalies)
    sheet.week_anomalies = json.dumps(week_anomalies) if week_anomalies else None
    return all_anomalies


def _worst(anomalies: List[dict]) -> Optional[str]:
    if not anomalies:
        return None
    return max((a["severity"] for a in anomalies), key=lambda s: SEVERITY_ORDER.get(s, 0))


def load_anomalies(raw: Optional[str]) -> List[dict]:
    if not raw:
        return []
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return []


# ---------------------------------------------------------------------------
# Cross-assignment risk rules
#
# A contractor may legitimately hold several assignments, so multiple projects
# on one day is NOT by itself suspicious. What is suspicious is time that could
# not physically have been worked: more than a calendar day's worth of hours,
# or the same hours claimed against two assignments at once.
#
# These functions are deliberately pure - they take plain dicts and return
# plain dicts - so the deterministic result never depends on an LLM.
# ---------------------------------------------------------------------------

#: A calendar day cannot contain more than this. Exceeding it is impossible,
#: not merely unusual, which is why it is CRITICAL rather than HIGH.
MAX_CALENDAR_DAY_HOURS = 24.0

#: An assignment billing beyond this multiple of its configured week is raised
#: as an assignment-limit finding.
ASSIGNMENT_LIMIT_CRITICAL_MULTIPLIER = 1.5


def overlap_hours(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> float:
    """Hours two time ranges share. Zero when they merely touch or are apart."""
    latest_start = max(a_start, b_start)
    earliest_end = min(a_end, b_end)
    seconds = (earliest_end - latest_start).total_seconds()
    return round(max(seconds, 0) / 3600.0, 2) if seconds > 0 else 0.0


def _day_anomaly(kind: str, severity: str, day: date, reason: str, **extra) -> dict:
    """Cross-assignment finding. Carries the evidence the vendor UI renders."""
    payload = {
        "type": kind,
        "severity": severity,
        "date": day.isoformat(),
        "reason": reason,
    }
    payload.update(extra)
    return payload


def detect_calendar_day_conflicts(day: date, day_entries: List[dict]) -> List[dict]:
    """Findings for one contractor on one calendar date, across every assignment.

    ``day_entries`` are dicts with at least: entry_id, assignment_id, project,
    start (datetime), end (datetime), hours (float).

    Detects:
      * OVER_24_HOURS            - reported hours exceed a physical day
      * OVERLAPPING_ASSIGNMENTS  - the same clock time claimed twice
      * DUPLICATE_TIME_ENTRY     - identical window on two assignments
    """
    found: List[dict] = []
    if not day_entries:
        return found

    reported = round(sum(float(e.get("hours") or 0) for e in day_entries), 2)
    projects = sorted({e["project"] for e in day_entries})

    # --- more hours than a calendar day physically holds -------------------
    if reported > MAX_CALENDAR_DAY_HOURS:
        found.append(_day_anomaly(
            "OVER_24_HOURS", "CRITICAL", day,
            f"Contractor reported {reported:g} hours on a single calendar day, "
            f"exceeding the maximum possible {MAX_CALENDAR_DAY_HOURS:g} hours.",
            reported_hours=reported,
            maximum_hours=MAX_CALENDAR_DAY_HOURS,
            projects=projects,
        ))

    # --- the same clock time claimed against two assignments --------------
    timed = [e for e in day_entries if e.get("start") and e.get("end")]
    ordered = sorted(timed, key=lambda e: (e["start"], e["end"], e["entry_id"]))
    for i, first in enumerate(ordered):
        for second in ordered[i + 1:]:
            # Two entries on the SAME assignment are already blocked at entry
            # time by assert_no_conflict; this rule is about cross-assignment.
            if first["assignment_id"] == second["assignment_id"]:
                continue
            shared = overlap_hours(first["start"], first["end"], second["start"], second["end"])
            if shared <= 0:
                continue

            pair = [
                {
                    "project": first["project"],
                    "assignment_id": first["assignment_id"],
                    "start": f"{first['start']:%H:%M}",
                    "end": f"{first['end']:%H:%M}",
                },
                {
                    "project": second["project"],
                    "assignment_id": second["assignment_id"],
                    "start": f"{second['start']:%H:%M}",
                    "end": f"{second['end']:%H:%M}",
                },
            ]
            identical = (
                first["start"] == second["start"] and first["end"] == second["end"]
            )
            if identical:
                found.append(_day_anomaly(
                    "DUPLICATE_TIME_ENTRY", "HIGH", day,
                    f"The identical window {first['start']:%H:%M}-{first['end']:%H:%M} is "
                    f"recorded against both {first['project']} and {second['project']}.",
                    overlap_hours=shared,
                    assignments=pair,
                ))
            else:
                found.append(_day_anomaly(
                    "OVERLAPPING_ASSIGNMENTS", "HIGH", day,
                    f"Contractor has overlapping working periods across multiple assignments: "
                    f"{first['project']} ({first['start']:%H:%M}-{first['end']:%H:%M}) and "
                    f"{second['project']} ({second['start']:%H:%M}-{second['end']:%H:%M}) "
                    f"overlap by {shared:g} hour(s).",
                    overlap_hours=shared,
                    assignments=pair,
                ))

    return found


def detect_assignment_limit(
    day: date,
    project: str,
    assignment_id: str,
    logged_hours: float,
    configured_hours: float,
) -> Optional[dict]:
    """Flag an assignment whose weekly hours run past its configured capacity."""
    if configured_hours <= 0 or logged_hours <= configured_hours:
        return None
    severity = (
        "HIGH" if logged_hours > configured_hours * ASSIGNMENT_LIMIT_CRITICAL_MULTIPLIER
        else "MEDIUM"
    )
    return _day_anomaly(
        "ASSIGNMENT_HOUR_LIMIT_EXCEEDED", severity, day,
        f"{logged_hours:g} hours logged against {project} this week exceeds its "
        f"configured {configured_hours:g}-hour week.",
        reported_hours=round(logged_hours, 2),
        maximum_hours=round(configured_hours, 2),
        assignment_id=assignment_id,
        projects=[project],
    )


#: Findings at or above this severity mark a timesheet as FLAGGED rather than
#: merely a warning.
FLAG_SEVERITIES = ("CRITICAL", "HIGH")


def flag_status(anomalies: List[dict]) -> str:
    """FLAGGED / WARNING / CLEAN for the vendor list."""
    if not anomalies:
        return "CLEAN"
    if any(a.get("severity") in FLAG_SEVERITIES for a in anomalies):
        return "FLAGGED"
    return "WARNING"
