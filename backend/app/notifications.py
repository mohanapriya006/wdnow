"""Email notifications.

Only one trigger exists today: when a vendor places a contractor on a project,
that contractor is emailed the details of *that* assignment at the address they
signed up with.

Design constraints this file honours:

* **Never block the request.** Sending happens after the assignment is
  committed, inside a try/except. A mail failure is logged and swallowed - the
  assignment is already saved and must not be rolled back because SMTP is down.
* **Off unless configured.** With no SMTP settings the message is written to a
  local outbox file instead of being sent, so the feature is demonstrable
  without credentials and cannot email anyone by accident.
* **Only the assigned contractor's own details.** The recipient is read from
  the contractor record tied to the assignment; no other contractor's data,
  and no bill rate, ever appears in the message.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from datetime import date, datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

#: Where messages land when SMTP is not configured. One file, appended to.
OUTBOX = Path(__file__).resolve().parent.parent / "outbox.log"


def _fmt(value: Optional[date]) -> str:
    return value.strftime("%d %b %Y") if value else "Open-ended"


def is_configured() -> bool:
    """True when a real SMTP host and sender are available."""
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


# ---------------------------------------------------------------------------
# Message construction
# ---------------------------------------------------------------------------

def build_assignment_email(
    *,
    contractor_name: str,
    contractor_email: str,
    vendor_name: str,
    project_name: str,
    role: str,
    start_date: Optional[date],
    end_date: Optional[date],
    working_hours: int,
    pay_rate: float,
    currency: str,
    location: Optional[str],
    work_mode: Optional[str],
    description: Optional[str],
    required_skills: Optional[str],
    notes: Optional[str],
) -> EmailMessage:
    """The assignment notice for one contractor.

    Carries only that contractor's own commercial terms. The client bill rate is
    deliberately excluded - it is vendor-to-client information.
    """
    symbol = {"INR": "₹", "USD": "$", "EUR": "€"}.get(currency, currency + " ")

    lines = [
        f"Hello {contractor_name},",
        "",
        f"{vendor_name} has assigned you to a project. The details are below.",
        "",
        f"Project        : {project_name}",
        f"Role           : {role}",
        f"Start date     : {_fmt(start_date)}",
        f"End date       : {_fmt(end_date)}",
        f"Working hours  : {working_hours} hours per week",
        f"Pay rate       : {symbol}{pay_rate:,.2f} per hour",
    ]
    if location:
        lines.append(f"Location       : {location}")
    if work_mode:
        lines.append(f"Work mode      : {work_mode}")
    if required_skills:
        lines.append(f"Skills         : {required_skills}")
    if description:
        lines += ["", "About the project:", description.strip()]
    if notes:
        lines += ["", "Notes from your vendor:", notes.strip()]

    lines += [
        "",
        "You can now log your daily start and end times against this project in "
        "the platform. Approved weekly hours become invoiceable automatically.",
        "",
        f"— {vendor_name}",
        "",
        "This is an automated message from the workforce management platform.",
    ]

    message = EmailMessage()
    message["Subject"] = f"New assignment: {project_name} - {role}"
    message["From"] = settings.SMTP_FROM or "no-reply@localhost"
    message["To"] = contractor_email
    message.set_content("\n".join(lines))
    return message


# ---------------------------------------------------------------------------
# Delivery
# ---------------------------------------------------------------------------

def _write_outbox(message: EmailMessage) -> None:
    """Fallback sink used when SMTP is not configured."""
    entry = (
        f"\n{'=' * 72}\n"
        f"{datetime.utcnow():%Y-%m-%d %H:%M:%S} UTC  (SMTP not configured - not sent)\n"
        f"To: {message['To']}\nSubject: {message['Subject']}\n{'-' * 72}\n"
        f"{message.get_content()}"
    )
    try:
        with OUTBOX.open("a", encoding="utf-8") as handle:
            handle.write(entry)
    except OSError:
        logger.warning("Could not write to the outbox file at %s", OUTBOX)
    logger.info("Assignment email queued to outbox for %s", message["To"])


def send(message: EmailMessage) -> bool:
    """Deliver one message. Returns True when it actually left the building.

    Every failure path is contained here: callers are never expected to handle
    an SMTP exception.
    """
    if not is_configured():
        _write_outbox(message)
        return False
    try:
        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(
                settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT,
                context=ssl.create_default_context(),
            )
        else:
            server = smtplib.SMTP(
                settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT
            )
        with server:
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                server.starttls(context=ssl.create_default_context())
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
        logger.info("Assignment email sent to %s", message["To"])
        return True
    except Exception:
        # Notification failure must never surface as an assignment failure.
        logger.exception("Assignment email to %s could not be sent", message["To"])
        _write_outbox(message)
        return False


def notify_assignment_created(assignment) -> bool:
    """Email the assigned contractor their new project details.

    Safe to call straight after commit; it swallows every error.
    """
    try:
        contractor = assignment.contractor
        if not contractor or not contractor.email:
            logger.info("Assignment %s has no contractor email to notify", assignment.id)
            return False
        message = build_assignment_email(
            contractor_name=contractor.name,
            contractor_email=contractor.email,
            vendor_name=assignment.vendor.name if assignment.vendor else "Your vendor",
            project_name=assignment.project_name,
            role=assignment.role,
            start_date=assignment.start_date,
            end_date=assignment.end_date,
            working_hours=assignment.working_hours,
            pay_rate=assignment.pay_rate,
            currency=assignment.currency,
            location=assignment.location,
            work_mode=assignment.work_mode,
            description=assignment.description,
            required_skills=assignment.required_skills,
            notes=assignment.notes,
        )
        return send(message)
    except Exception:
        logger.exception("Could not prepare the assignment email for %s", getattr(assignment, "id", "?"))
        return False
