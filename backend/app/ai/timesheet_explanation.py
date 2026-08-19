"""AI explanation of an already-detected contractor timesheet anomaly.

The deterministic rule engine decides whether a timesheet is suspicious. This
module only puts that decision into words for the vendor: what was reported,
which rule it breached, which assignments were involved, and why a review is
warranted.

It never calculates an anomaly, never contradicts the engine, and never decides
whether the timesheet should be approved. If Gemini is unavailable the
deterministic fallback below is returned instead, so the feature keeps working
with no API key configured.
"""
from __future__ import annotations

from typing import List, Optional

from app.ai.llm import LLMExplanationService

#: Verbatim instruction for the model. The neutral-language rules matter as much
#: as the factual ones: this text is shown to a vendor about a named person.
SYSTEM_INSTRUCTION = """You are a responsible contingent workforce management AI assistant.

You explain contractor timesheet anomalies that have ALREADY been detected by deterministic backend rules.

Do not independently calculate or invent anomalies.

Use ONLY the supplied contractor timesheet and anomaly data.

Do not accuse the contractor of fraud, cheating, misconduct, or wrongdoing.

Use neutral language such as:
- anomaly detected
- suspicious
- unusual
- requires review
- conflicting time entries

Clearly explain:
1. The contractor's reported hours.
2. The detected rule violation.
3. The assignments involved.
4. The overlapping timelines and durations.
5. Why the Vendor should review the timesheet.

Do not expose information about other contractors.

Do not reveal sensitive information that is not necessary.

Do not make decisions about:
- hiring
- termination
- payroll approval
- timesheet approval
- contractor discipline

The Vendor makes the final decision.

Return structured JSON only with exactly these keys:
risk_level, title, summary, reasons, overlap_summary, recommendation
where reasons is an array of short strings."""

DISCLAIMER = "This is an automated risk indicator and does not determine wrongdoing."

#: Words the model must never use about a contractor. If any appears the reply
#: is discarded and the neutral deterministic text is used instead.
FORBIDDEN_TERMS = (
    "fraud", "fraudulent", "cheat", "cheating", "misconduct", "theft", "stealing",
    "dishonest", "criminal", "lying", "liar", "guilty", "scam",
)

RISK_LEVELS = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE")

_TYPE_LABELS = {
    "OVER_24_HOURS": "Reported hours exceed a calendar day",
    "OVERLAPPING_ASSIGNMENTS": "Overlapping assignment timelines",
    "DUPLICATE_TIME_ENTRY": "Duplicate time entry across assignments",
    "EXCESSIVE_DAILY_HOURS": "Unusually long working day",
    "EXCESSIVE_WEEKLY_HOURS": "Unusually long working week",
    "ASSIGNMENT_HOUR_LIMIT_EXCEEDED": "Assignment hour limit exceeded",
    "OVERLAPPING_ENTRY": "Overlapping entries on one assignment",
    "DUPLICATE_ENTRY": "Duplicate entry",
    "MISSING_END_TIME": "Missing end time",
    "INVALID_END_TIME": "Invalid end time",
    "HOLIDAY_WORK": "Work recorded on a non-working day",
    "TIME_RULE_VIOLATION": "Configured time-rule violation",
}


# ---------------------------------------------------------------------------
# Context assembly - only what the explanation needs
# ---------------------------------------------------------------------------

def build_context(
    *,
    contractor_name: str,
    week_start: str,
    week_end: str,
    total_hours: float,
    anomalies: List[dict],
    days: List[dict],
) -> str:
    """Prompt body. Deliberately narrow: one contractor, one timesheet.

    No identifiers, rates, contact details or other contractors' data are
    included - the model is given the minimum needed to describe the finding.
    """
    lines = [
        "CONTRACTOR TIMESHEET UNDER REVIEW",
        f"Contractor: {contractor_name}",
        f"Week: {week_start} to {week_end}",
        f"Total hours reported this week: {total_hours:g}",
        "",
        "ANOMALIES ALREADY DETECTED BY THE BACKEND RULE ENGINE:",
    ]
    for a in anomalies:
        detail = [f"- [{a.get('severity')}] {a.get('type')} on {a.get('date')}: {a.get('reason')}"]
        if a.get("reported_hours") is not None:
            detail.append(
                f"    reported_hours={a['reported_hours']:g} maximum_hours={a.get('maximum_hours')}"
            )
        if a.get("overlap_hours"):
            pair = a.get("assignments") or []
            names = " and ".join(
                f"{p.get('project')} ({p.get('start')}-{p.get('end')})" for p in pair
            )
            detail.append(f"    overlap_hours={a['overlap_hours']:g} between {names}")
        lines.extend(detail)

    conflicted = [d for d in days if d.get("multi_project") or d.get("overlaps")]
    if conflicted:
        lines.append("")
        lines.append("CALENDAR DAYS INVOLVING MORE THAN ONE ASSIGNMENT:")
        for day in conflicted:
            lines.append(
                f"- {day['date']}: {day['reported_hours']:g} hours reported across "
                f"{len(day['projects'])} project(s)"
            )
            for entry in day.get("entries", []):
                lines.append(
                    f"    {entry['project']}: {entry.get('start')} - {entry.get('end')} "
                    f"({entry['hours']:g}h)"
                )

    lines.append("")
    lines.append(
        "Explain these already-detected findings to the vendor in neutral language. "
        "Do not recalculate anything and do not decide whether to approve the timesheet."
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Deterministic fallback
# ---------------------------------------------------------------------------

def _sentence_list(items: List[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " and " + items[-1]


def fallback_explanation(
    *,
    contractor_name: str,
    week_start: str,
    total_hours: float,
    anomalies: List[dict],
    risk_level: str,
) -> dict:
    """Neutral explanation built from the detected findings alone.

    Used when Gemini is not configured, errors, or returns something unusable.
    The vendor still gets the reported hours, the rule breached and the overlap
    evidence - the feature simply loses the narrative phrasing.
    """
    over = next((a for a in anomalies if a.get("type") == "OVER_24_HOURS"), None)
    overlaps = [
        a for a in anomalies
        if a.get("type") in ("OVERLAPPING_ASSIGNMENTS", "DUPLICATE_TIME_ENTRY")
        and a.get("overlap_hours")
    ]

    if over:
        summary = (
            f"The contractor reported {over.get('reported_hours', 0):g} hours on "
            f"{over.get('date')}, which exceeds the maximum possible "
            f"{over.get('maximum_hours', 24):g} hours in a calendar day."
        )
    elif overlaps:
        summary = (
            "The submitted timesheet contains conflicting time entries: the same hours "
            "are recorded against more than one assignment."
        )
    elif anomalies:
        summary = (
            f"The submitted timesheet triggered {len(anomalies)} rule check(s) "
            f"for the week beginning {week_start} and requires review."
        )
    else:
        summary = (
            f"No anomalies were detected on this timesheet for the week beginning {week_start}."
        )

    reasons = [a.get("reason", "") for a in anomalies if a.get("reason")]

    overlap_summary = None
    if overlaps:
        phrases = []
        for a in overlaps:
            pair = a.get("assignments") or []
            if len(pair) == 2:
                phrases.append(
                    f"{pair[0].get('project')} and {pair[1].get('project')} overlap by "
                    f"{a['overlap_hours']:g} hour(s)"
                )
        # Only the first character is raised: str.capitalize() would lowercase
        # the project names that follow it.
        joined = _sentence_list(phrases)
        overlap_summary = (joined[:1].upper() + joined[1:] + ".") if joined else None

    recommendation = (
        "Review the contractor's submitted time entries before approving the timesheet."
        if anomalies else
        "No review action is required for this timesheet."
    )

    return {
        "risk_level": risk_level,
        "title": (
            "Contractor timesheet requires review" if anomalies
            else "No anomalies detected"
        ),
        "summary": summary,
        "reasons": reasons,
        "overlap_summary": overlap_summary,
        "recommendation": recommendation,
        "disclaimer": DISCLAIMER,
        "generated_offline": True,
    }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _is_safe(payload: dict) -> bool:
    """Reject a reply that accuses the contractor or omits required fields."""
    for key in ("summary", "recommendation", "title"):
        if not isinstance(payload.get(key), str) or not payload[key].strip():
            return False
    blob = " ".join(
        [str(payload.get("summary", "")), str(payload.get("recommendation", "")),
         str(payload.get("title", "")), str(payload.get("overlap_summary") or ""),
         " ".join(str(r) for r in payload.get("reasons", []) or [])]
    ).lower()
    return not any(term in blob for term in FORBIDDEN_TERMS)


def explain_timesheet_risk(
    *,
    contractor_name: str,
    week_start: str,
    week_end: str,
    total_hours: float,
    risk_level: str,
    anomalies: List[dict],
    days: List[dict],
    service: Optional[LLMExplanationService] = None,
) -> dict:
    """Explain the detected findings, falling back when the model cannot help.

    ``risk_level`` comes from the rule engine and is never taken from the model:
    the AI describes the severity, it does not get to change it.
    """
    fallback = fallback_explanation(
        contractor_name=contractor_name,
        week_start=week_start,
        total_hours=total_hours,
        anomalies=anomalies,
        risk_level=risk_level,
    )
    if not anomalies:
        return fallback

    llm = service or LLMExplanationService()
    payload = llm.generate_json(
        system_instruction=SYSTEM_INSTRUCTION,
        prompt=build_context(
            contractor_name=contractor_name,
            week_start=week_start,
            week_end=week_end,
            total_hours=total_hours,
            anomalies=anomalies,
            days=days,
        ),
    )
    if not payload or not _is_safe(payload):
        return fallback

    reasons = payload.get("reasons") or []
    if not isinstance(reasons, list):
        reasons = [str(reasons)]

    return {
        # Severity stays with the deterministic engine.
        "risk_level": risk_level,
        "title": str(payload["title"]).strip(),
        "summary": str(payload["summary"]).strip(),
        "reasons": [str(r).strip() for r in reasons if str(r).strip()] or fallback["reasons"],
        "overlap_summary": (
            str(payload["overlap_summary"]).strip()
            if payload.get("overlap_summary") else fallback["overlap_summary"]
        ),
        "recommendation": str(payload["recommendation"]).strip(),
        "disclaimer": DISCLAIMER,
        "generated_offline": False,
    }


def label_for(anomaly_type: str) -> str:
    return _TYPE_LABELS.get(anomaly_type, anomaly_type.replace("_", " ").title())
