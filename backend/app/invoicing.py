"""Invoice calculation engine.

The server is the only place money is computed. Every figure derives from rows
already in PostgreSQL - approved weekly reports, the assignment's contractual
rate, and the vendor's configured tax rules - so a client cannot influence an
amount by posting one.

Billing rule:

    Base      = approved regular hours x contractual hourly rate
    Overtime  = approved overtime hours x hourly rate x overtime multiplier
    Gross     = Base + Overtime
    Net       = Gross + taxes - deductions + adjustments

Only APPROVED weekly reports that have never been billed are eligible, which is
what makes generation idempotent.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import List, Optional, Sequence

from sqlalchemy.orm import Session

from app.models import (
    Assignment,
    Invoice,
    InvoiceLine,
    InvoiceLineType,
    InvoiceStatus,
    InvoiceTaxRule,
    TaxRuleType,
    Timesheet,
    TimesheetStatus,
)

#: Overtime premium applied to the contractual rate. Configuration, not a rate
#: change - the assignment's pay_rate is never modified.
DEFAULT_OVERTIME_MULTIPLIER = 1.5

#: Days from invoice date to due date when the vendor does not specify one.
DEFAULT_PAYMENT_TERM_DAYS = 30

#: Statuses that still occupy the workflow; a rejected invoice releases its
#: weekly reports so they can be corrected and billed again.
OPEN_STATUSES = (
    InvoiceStatus.DRAFT,
    InvoiceStatus.GENERATED,
    InvoiceStatus.SUBMITTED,
    InvoiceStatus.APPROVED,
    InvoiceStatus.PAID,
)


class InvoiceError(Exception):
    """A generation attempt that cannot proceed, surfaced as a 4xx."""


def money(value: float) -> float:
    """Round to currency precision. Applied at every boundary so totals add up."""
    return round(float(value or 0) + 0.0, 2)


# ---------------------------------------------------------------------------
# Eligible work
# ---------------------------------------------------------------------------

def billable_timesheets(
    db: Session,
    assignment_id: str,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
) -> List[Timesheet]:
    """Approved, never-invoiced weekly reports for one assignment.

    Unapproved, rejected and already-billed weeks are excluded here rather than
    filtered later, so no path can turn them into a payable amount.
    """
    query = db.query(Timesheet).filter(
        Timesheet.assignment_id == assignment_id,
        Timesheet.status == TimesheetStatus.APPROVED,
        Timesheet.invoice_id.is_(None),
    )
    if period_start:
        query = query.filter(Timesheet.week_end >= period_start)
    if period_end:
        query = query.filter(Timesheet.week_start <= period_end)
    return query.order_by(Timesheet.week_start).all()


def active_tax_rules(db: Session, vendor_id: str) -> List[InvoiceTaxRule]:
    return (
        db.query(InvoiceTaxRule)
        .filter(InvoiceTaxRule.vendor_id == vendor_id, InvoiceTaxRule.is_active.is_(True))
        .order_by(InvoiceTaxRule.sort_order, InvoiceTaxRule.code)
        .all()
    )


# ---------------------------------------------------------------------------
# Calculation
# ---------------------------------------------------------------------------

@dataclass
class CalculatedLine:
    line_type: InvoiceLineType
    description: str
    quantity: float
    rate: float
    amount: float
    timesheet_id: Optional[str] = None
    week_start: Optional[date] = None
    week_end: Optional[date] = None


@dataclass
class Calculation:
    """A fully-priced invoice that has not been persisted yet."""
    assignment_id: str
    contractor_id: str
    contractor_name: str
    project_id: Optional[str]
    project_name: str
    currency: str
    period_start: Optional[date]
    period_end: Optional[date]
    hourly_rate: float
    overtime_multiplier: float
    regular_hours: float = 0.0
    overtime_hours: float = 0.0
    total_hours: float = 0.0
    base_amount: float = 0.0
    overtime_amount: float = 0.0
    gross_amount: float = 0.0
    taxable_amount: float = 0.0
    tax_amount: float = 0.0
    deduction_amount: float = 0.0
    adjustment_amount: float = 0.0
    net_payable: float = 0.0
    lines: List[CalculatedLine] = field(default_factory=list)
    timesheet_ids: List[str] = field(default_factory=list)
    weeks: int = 0
    warnings: List[str] = field(default_factory=list)


def calculate_invoice(
    db: Session,
    assignment: Assignment,
    timesheets: Sequence[Timesheet],
    *,
    adjustment_amount: float = 0.0,
    adjustment_note: Optional[str] = None,
    overtime_multiplier: Optional[float] = None,
) -> Calculation:
    """Price a set of approved weekly reports.

    Hours come from the stored daily entries rather than from any client input.
    Missing or null commercial fields fall back safely: a null rate is treated
    as zero and surfaced as a warning rather than crashing the invoice.
    """
    rate = float(assignment.pay_rate or 0)
    multiplier = float(
        overtime_multiplier if overtime_multiplier is not None else DEFAULT_OVERTIME_MULTIPLIER
    )

    calc = Calculation(
        assignment_id=assignment.id,
        contractor_id=assignment.contractor_id,
        contractor_name=assignment.contractor.name if assignment.contractor else "Unknown",
        project_id=assignment.project_id,
        project_name=assignment.project_name,
        currency=assignment.currency or "INR",
        period_start=min((t.week_start for t in timesheets), default=None),
        period_end=max((t.week_end for t in timesheets), default=None),
        hourly_rate=rate,
        overtime_multiplier=multiplier,
    )

    if rate <= 0:
        calc.warnings.append(
            "This assignment has no hourly rate configured, so billable amounts are zero."
        )

    seen: set[str] = set()
    for sheet in sorted(timesheets, key=lambda t: t.week_start):
        # Defence in depth: the query already filters these, but generation
        # must never price a week the vendor has not approved.
        if sheet.status != TimesheetStatus.APPROVED:
            calc.warnings.append(f"Week of {sheet.week_start} skipped: not approved.")
            continue
        if sheet.invoice_id:
            calc.warnings.append(f"Week of {sheet.week_start} skipped: already invoiced.")
            continue
        if sheet.id in seen:
            calc.warnings.append(f"Week of {sheet.week_start} skipped: duplicate in request.")
            continue
        seen.add(sheet.id)

        regular = money(sum(e.regular_hours or 0 for e in sheet.entries))
        overtime = money(sum(e.overtime_hours or 0 for e in sheet.entries))
        if regular <= 0 and overtime <= 0:
            calc.warnings.append(f"Week of {sheet.week_start} skipped: no billable hours.")
            continue

        calc.weeks += 1
        calc.timesheet_ids.append(sheet.id)
        label = f"{sheet.week_start:%d %b} - {sheet.week_end:%d %b %Y}"

        if regular > 0:
            amount = money(regular * rate)
            calc.regular_hours = money(calc.regular_hours + regular)
            calc.base_amount = money(calc.base_amount + amount)
            calc.lines.append(CalculatedLine(
                line_type=InvoiceLineType.REGULAR,
                description=f"Regular hours, week {label}",
                quantity=regular, rate=rate, amount=amount,
                timesheet_id=sheet.id, week_start=sheet.week_start, week_end=sheet.week_end,
            ))
        if overtime > 0:
            ot_rate = money(rate * multiplier)
            amount = money(overtime * ot_rate)
            calc.overtime_hours = money(calc.overtime_hours + overtime)
            calc.overtime_amount = money(calc.overtime_amount + amount)
            calc.lines.append(CalculatedLine(
                line_type=InvoiceLineType.OVERTIME,
                description=f"Overtime hours at {multiplier:g}x, week {label}",
                quantity=overtime, rate=ot_rate, amount=amount,
                # Only the regular line carries the timesheet link, so the
                # unique constraint that enforces "bill a week once" holds even
                # when the week also has overtime.
                week_start=sheet.week_start, week_end=sheet.week_end,
            ))

    calc.total_hours = money(calc.regular_hours + calc.overtime_hours)
    calc.gross_amount = money(calc.base_amount + calc.overtime_amount)
    calc.taxable_amount = calc.gross_amount

    # Taxes and statutory deductions, from the vendor's configured rules.
    for rule in active_tax_rules(db, assignment.vendor_id):
        amount = money(calc.taxable_amount * (rule.rate_percent or 0) / 100)
        if amount == 0:
            continue
        if rule.rule_type == TaxRuleType.TAX:
            calc.tax_amount = money(calc.tax_amount + amount)
            calc.lines.append(CalculatedLine(
                line_type=InvoiceLineType.TAX,
                description=f"{rule.label} @ {rule.rate_percent:g}%",
                quantity=1, rate=rule.rate_percent, amount=amount,
            ))
        else:
            calc.deduction_amount = money(calc.deduction_amount + amount)
            calc.lines.append(CalculatedLine(
                line_type=InvoiceLineType.DEDUCTION,
                description=f"{rule.label} @ {rule.rate_percent:g}%",
                quantity=1, rate=rule.rate_percent, amount=money(-amount),
            ))

    if adjustment_amount:
        calc.adjustment_amount = money(adjustment_amount)
        calc.lines.append(CalculatedLine(
            line_type=InvoiceLineType.ADJUSTMENT,
            description=adjustment_note or (
                "Bonus" if adjustment_amount > 0 else "Penalty / correction"
            ),
            quantity=1, rate=0, amount=calc.adjustment_amount,
        ))

    calc.net_payable = money(
        calc.gross_amount + calc.tax_amount - calc.deduction_amount + calc.adjustment_amount
    )
    return calc


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def next_invoice_number(db: Session, vendor_id: str, on: date) -> str:
    """Sequential per vendor per year, e.g. INV-2026-0007.

    Called inside the generating transaction; the unique index on
    invoices.invoice_number is the real guard against a concurrent collision.
    """
    prefix = f"INV-{on.year}-"
    used = (
        db.query(Invoice.invoice_number)
        .filter(Invoice.vendor_id == vendor_id, Invoice.invoice_number.like(f"{prefix}%"))
        .all()
    )
    highest = 0
    for (number,) in used:
        try:
            highest = max(highest, int(number.rsplit("-", 1)[1]))
        except (IndexError, ValueError):
            continue
    return f"{prefix}{highest + 1:04d}"


def persist_invoice(
    db: Session,
    assignment: Assignment,
    calc: Calculation,
    *,
    invoice_date: Optional[date] = None,
    due_date: Optional[date] = None,
    notes: Optional[str] = None,
    performance_score: Optional[float] = None,
    performance_adjusted_amount: Optional[float] = None,
) -> Invoice:
    """Write the calculated invoice and claim its weekly reports.

    The caller owns the transaction. Claiming each timesheet (setting
    invoice_id) plus the unique index on invoice_lines.timesheet_id means a
    second concurrent attempt fails at the database rather than double-billing.
    """
    if not calc.timesheet_ids:
        raise InvoiceError("There are no approved, un-invoiced hours to bill for this selection.")

    issued = invoice_date or date.today()
    invoice = Invoice(
        invoice_number=next_invoice_number(db, assignment.vendor_id, issued),
        vendor_id=assignment.vendor_id,
        contractor_id=assignment.contractor_id,
        assignment_id=assignment.id,
        project_id=assignment.project_id,
        period_start=calc.period_start,
        period_end=calc.period_end,
        invoice_date=issued,
        due_date=due_date or (issued + timedelta(days=DEFAULT_PAYMENT_TERM_DAYS)),
        currency=calc.currency,
        regular_hours=calc.regular_hours,
        overtime_hours=calc.overtime_hours,
        total_hours=calc.total_hours,
        hourly_rate=calc.hourly_rate,
        overtime_multiplier=calc.overtime_multiplier,
        base_amount=calc.base_amount,
        overtime_amount=calc.overtime_amount,
        gross_amount=calc.gross_amount,
        taxable_amount=calc.taxable_amount,
        tax_amount=calc.tax_amount,
        deduction_amount=calc.deduction_amount,
        adjustment_amount=calc.adjustment_amount,
        net_payable=calc.net_payable,
        performance_score=performance_score,
        performance_adjusted_amount=performance_adjusted_amount,
        status=InvoiceStatus.GENERATED,
        notes=notes,
        generated_at=datetime.utcnow(),
    )
    db.add(invoice)
    db.flush()

    for line in calc.lines:
        db.add(InvoiceLine(
            invoice_id=invoice.id,
            timesheet_id=line.timesheet_id,
            line_type=line.line_type,
            description=line.description,
            week_start=line.week_start,
            week_end=line.week_end,
            quantity=line.quantity,
            rate=line.rate,
            amount=line.amount,
        ))

    claimed = (
        db.query(Timesheet)
        .filter(
            Timesheet.id.in_(calc.timesheet_ids),
            Timesheet.status == TimesheetStatus.APPROVED,
            Timesheet.invoice_id.is_(None),
        )
        .update({Timesheet.invoice_id: invoice.id}, synchronize_session=False)
    )
    if claimed != len(calc.timesheet_ids):
        # Another request billed one of these weeks between calculation and
        # write. Abort rather than issue an invoice for work already billed.
        raise InvoiceError(
            "Some of these weekly reports were invoiced by another request. Please retry."
        )

    db.flush()
    return invoice


def release_timesheets(db: Session, invoice: Invoice) -> None:
    """Return an invoice's weekly reports to the billable pool.

    Used when an invoice is rejected, so corrected hours can be re-billed
    without leaving the work permanently unpayable.
    """
    db.query(Timesheet).filter(Timesheet.invoice_id == invoice.id).update(
        {Timesheet.invoice_id: None}, synchronize_session=False
    )
    for line in invoice.lines:
        line.timesheet_id = None
