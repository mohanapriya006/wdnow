import enum
import uuid
from datetime import datetime, date

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_id(prefix: str) -> str:
    """Generate a short, human-friendly unique ID, e.g. V-3F2A9C."""
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


class UserRole(str, enum.Enum):
    VENDOR = "VENDOR"
    CONTRACTOR = "CONTRACTOR"


class VendorStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    PENDING = "PENDING"


class ContractorStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    BENCH = "BENCH"  # onboarded but not currently on an assignment


class AssignmentStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    TERMINATED = "TERMINATED"


class ProjectStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class MilestoneStatus(str, enum.Enum):
    UPCOMING = "UPCOMING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    DELAYED = "DELAYED"


class TimesheetStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"   # surfaced to the contractor as PENDING review
    FLAGGED = "FLAGGED"       # legacy value, retained so historic rows still load
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class InvoiceStatus(str, enum.Enum):
    """Lifecycle of a vendor invoice.

    DRAFT is reserved for a saved-but-unfinalised invoice; the generator writes
    GENERATED directly. PAID and REJECTED are terminal.
    """
    DRAFT = "DRAFT"
    GENERATED = "GENERATED"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    PAID = "PAID"
    REJECTED = "REJECTED"


class InvoiceLineType(str, enum.Enum):
    REGULAR = "REGULAR"        # approved regular hours from one weekly report
    OVERTIME = "OVERTIME"      # approved overtime hours from one weekly report
    TAX = "TAX"                # added to the gross (e.g. GST)
    DEDUCTION = "DEDUCTION"    # withheld from the gross (e.g. TDS)
    ADJUSTMENT = "ADJUSTMENT"  # signed manual correction, bonus or penalty


class TaxRuleType(str, enum.Enum):
    TAX = "TAX"
    DEDUCTION = "DEDUCTION"


class TimesheetPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: gen_id("U"))
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), nullable=False)

    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=True)
    contractor_id = Column(String, ForeignKey("contractors.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="users", foreign_keys=[vendor_id])
    contractor = relationship("Contractor", back_populates="user", foreign_keys=[contractor_id])


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(String, primary_key=True, default=lambda: gen_id("V"))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    tax_id = Column(String, nullable=True)
    status = Column(SAEnum(VendorStatus), default=VendorStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="vendor", foreign_keys="User.vendor_id")
    contractors = relationship("Contractor", back_populates="vendor", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="vendor", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="vendor", cascade="all, delete-orphan")


class Contractor(Base):
    __tablename__ = "contractors"

    id = Column(String, primary_key=True, default=lambda: gen_id("C"))
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=False)

    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=True)
    skills = Column(String, nullable=True)  # comma separated for simplicity
    experience = Column(String, nullable=True)  # e.g. "5 years"
    location = Column(String, nullable=True)
    status = Column(SAEnum(ContractorStatus), default=ContractorStatus.BENCH, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="contractors")
    user = relationship("User", back_populates="contractor", uselist=False, foreign_keys="User.contractor_id")
    assignments = relationship("Assignment", back_populates="contractor", cascade="all, delete-orphan")


class Project(Base):
    """A vendor-owned project/work order template.

    Assignment records snapshot the commercial and work terms at the time a
    person is placed, so later project edits do not rewrite payroll, invoice,
    analytics, or timesheet history.
    """
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=lambda: gen_id("P"))
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    role = Column(String, nullable=False)
    required_skills = Column(String, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    location = Column(String, nullable=True)
    work_mode = Column(String, default="REMOTE", nullable=False)
    working_hours = Column(Integer, default=40, nullable=False)
    pay_rate = Column(Float, nullable=False)
    currency = Column(String, default="INR", nullable=False)
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.OPEN, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="projects")
    assignments = relationship("Assignment", back_populates="project")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")


class Milestone(Base):
    __tablename__ = "milestones"
    id = Column(String, primary_key=True, default=lambda: gen_id("M"))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(SAEnum(TimesheetPriority), default=TimesheetPriority.MEDIUM, nullable=False)
    status = Column(SAEnum(MilestoneStatus), default=MilestoneStatus.UPCOMING, nullable=False)
    # Stamped when the milestone first reaches COMPLETED, so the dashboard can
    # compare planned due_date against actual delivery.
    completed_at = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="milestones")
    time_entries = relationship("TimeEntry", back_populates="milestone")


class Assignment(Base):
    """
    The central entity of the platform. Every future module (timesheets,
    expenses, milestones, rate cards, invoices, payroll) will hang off
    assignment_id as a foreign key, which is why this table is kept
    intentionally rich even in this initial phase.
    """

    __tablename__ = "assignments"

    id = Column(String, primary_key=True, default=lambda: gen_id("A"))
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=False)
    contractor_id = Column(String, ForeignKey("contractors.id"), nullable=False)
    # Nullable only for backwards-compatible migration of legacy assignments.
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)

    project_name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    working_hours = Column(Integer, default=40, nullable=False)  # hours/week

    pay_rate = Column(Float, nullable=False)   # what contractor is paid, per hour
    bill_rate = Column(Float, nullable=False)  # what client is billed, per hour
    currency = Column(String, default="INR", nullable=False)

    status = Column(SAEnum(AssignmentStatus), default=AssignmentStatus.ACTIVE, nullable=False)
    notes = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    required_skills = Column(String, nullable=True)
    location = Column(String, nullable=True)
    work_mode = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="assignments")
    contractor = relationship("Contractor", back_populates="assignments")
    project = relationship("Project", back_populates="assignments")
    timesheets = relationship("Timesheet", back_populates="assignment", cascade="all, delete-orphan")


class Timesheet(Base):
    __tablename__ = "timesheets"
    id = Column(String, primary_key=True, default=lambda: gen_id("TS"))
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=False, index=True)
    assignment_id = Column(String, ForeignKey("assignments.id"), nullable=False, index=True)
    week_start = Column(Date, nullable=False, index=True)
    week_end = Column(Date, nullable=False)
    status = Column(SAEnum(TimesheetStatus), default=TimesheetStatus.DRAFT, nullable=False)
    contractor_summary = Column(Text, nullable=True)
    vendor_comment = Column(Text, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    # A rejection always carries a reason; the vendor cannot reject without one.
    rejected_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    # Detection results, written by app.timesheet_rules so the vendor list can
    # be split into normal vs anomaly reports with a plain SQL filter.
    has_anomalies = Column(Integer, default=0, nullable=False)
    anomaly_count = Column(Integer, default=0, nullable=False)
    anomaly_severity = Column(String, nullable=True)
    week_anomalies = Column(Text, nullable=True)  # JSON, week-level findings only
    # JSON. Cross-assignment findings (>24h calendar days, overlapping projects)
    # written by app.timesheet_risk, which can see the contractor's other
    # assignments where the per-sheet rules cannot.
    cross_anomalies = Column(Text, nullable=True)
    # Set when the week's approved hours are billed. A non-null value is what
    # stops the same weekly report being invoiced twice.
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    assignment = relationship("Assignment", back_populates="timesheets")
    entries = relationship("TimeEntry", back_populates="timesheet", cascade="all, delete-orphan")
    audits = relationship("TimesheetAudit", back_populates="timesheet", cascade="all, delete-orphan")


class TimeEntry(Base):
    __tablename__ = "time_entries"
    id = Column(String, primary_key=True, default=lambda: gen_id("TE"))
    timesheet_id = Column(String, ForeignKey("timesheets.id"), nullable=False, index=True)
    milestone_id = Column(String, ForeignKey("milestones.id"), nullable=True)
    work_date = Column(Date, nullable=False)
    # clock_in / clock_out remain the "HH:MM" display values; start_at / end_at
    # are the canonical timestamps the backend calculates and validates against.
    clock_in = Column(String, nullable=True)
    clock_out = Column(String, nullable=True)
    start_at = Column(DateTime, nullable=True, index=True)
    end_at = Column(DateTime, nullable=True)
    break_minutes = Column(Integer, default=0, nullable=False)
    # Raw elapsed end-minus-start. Stored for later analytics/invoicing but not
    # exposed through the API; total_hours (net of break) is what users see.
    worked_hours = Column(Float, default=0, nullable=False)
    regular_hours = Column(Float, default=0, nullable=False)
    overtime_hours = Column(Float, default=0, nullable=False)
    total_hours = Column(Float, default=0, nullable=False)
    work_location = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    is_flagged = Column(Integer, default=0, nullable=False)
    flag_reason = Column(Text, nullable=True)
    # Automatic detection results from app.timesheet_rules.
    has_anomaly = Column(Integer, default=0, nullable=False)
    anomaly_severity = Column(String, nullable=True)
    anomaly_details = Column(Text, nullable=True)  # JSON list of findings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    timesheet = relationship("Timesheet", back_populates="entries")
    milestone = relationship("Milestone", back_populates="time_entries")


class TimesheetAudit(Base):
    __tablename__ = "timesheet_audits"
    id = Column(String, primary_key=True, default=lambda: gen_id("AUD"))
    timesheet_id = Column(String, ForeignKey("timesheets.id"), nullable=False, index=True)
    actor_role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    timesheet = relationship("Timesheet", back_populates="audits")


# ---------------------------------------------------------------------------
# Invoicing
#
# An invoice bills a contractor's APPROVED weekly reports for one assignment
# over one period. Every monetary column is written by app.invoicing from
# database records; nothing is accepted from the client.
# ---------------------------------------------------------------------------

class InvoiceTaxRule(Base):
    """Vendor-configurable tax and deduction rules.

    Rates live here rather than in code so GST/TDS (or any other regime) can be
    changed per vendor without a release. Each generated invoice snapshots the
    rules it used into its own lines, so later edits never rewrite history.
    """
    __tablename__ = "invoice_tax_rules"
    __table_args__ = (UniqueConstraint("vendor_id", "code", name="uq_tax_rule_vendor_code"),)

    id = Column(String, primary_key=True, default=lambda: gen_id("TAX"))
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=False, index=True)
    code = Column(String, nullable=False)          # e.g. GST, TDS
    label = Column(String, nullable=False)
    rule_type = Column(SAEnum(TaxRuleType), nullable=False)
    rate_percent = Column(Float, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("Vendor")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, default=lambda: gen_id("INV"))
    # Human-facing sequential reference, unique across the platform.
    invoice_number = Column(String, unique=True, nullable=False, index=True)

    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=False, index=True)
    contractor_id = Column(String, ForeignKey("contractors.id"), nullable=False, index=True)
    assignment_id = Column(String, ForeignKey("assignments.id"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)

    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    currency = Column(String, default="INR", nullable=False)

    # Hours and rates, snapshotted from the approved weekly reports.
    regular_hours = Column(Float, default=0, nullable=False)
    overtime_hours = Column(Float, default=0, nullable=False)
    total_hours = Column(Float, default=0, nullable=False)
    hourly_rate = Column(Float, default=0, nullable=False)
    overtime_multiplier = Column(Float, default=1.0, nullable=False)

    # Money. gross = base + overtime; net = gross + tax - deductions + adjustment.
    base_amount = Column(Float, default=0, nullable=False)
    overtime_amount = Column(Float, default=0, nullable=False)
    gross_amount = Column(Float, default=0, nullable=False)
    taxable_amount = Column(Float, default=0, nullable=False)
    tax_amount = Column(Float, default=0, nullable=False)
    deduction_amount = Column(Float, default=0, nullable=False)
    adjustment_amount = Column(Float, default=0, nullable=False)
    net_payable = Column(Float, default=0, nullable=False)

    # Analytical only. The contractual hourly_rate above is never altered by it.
    performance_score = Column(Float, nullable=True)
    performance_adjusted_amount = Column(Float, nullable=True)

    status = Column(SAEnum(InvoiceStatus), default=InvoiceStatus.GENERATED, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    payment_reference = Column(String, nullable=True)
    payment_date = Column(Date, nullable=True)

    generated_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("Vendor")
    contractor = relationship("Contractor")
    assignment = relationship("Assignment")
    project = relationship("Project")
    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")
    audits = relationship("InvoiceAudit", back_populates="invoice", cascade="all, delete-orphan")
    timesheets = relationship("Timesheet", foreign_keys="Timesheet.invoice_id")


class InvoiceLine(Base):
    """One component of an invoice: billed hours, a tax, or an adjustment.

    ``timesheet_id`` is unique across the table, which is the database-level
    guarantee that a single approved weekly report can never be billed twice.
    Tax/deduction/adjustment lines leave it NULL, and PostgreSQL permits any
    number of NULLs in a unique index.
    """
    __tablename__ = "invoice_lines"
    __table_args__ = (UniqueConstraint("timesheet_id", name="uq_invoice_line_timesheet"),)

    id = Column(String, primary_key=True, default=lambda: gen_id("INL"))
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False, index=True)
    timesheet_id = Column(String, ForeignKey("timesheets.id"), nullable=True)
    line_type = Column(SAEnum(InvoiceLineType), nullable=False)
    description = Column(String, nullable=False)
    week_start = Column(Date, nullable=True)
    week_end = Column(Date, nullable=True)
    quantity = Column(Float, default=0, nullable=False)   # hours, or 1 for a charge
    rate = Column(Float, default=0, nullable=False)       # per-hour rate, or percent
    amount = Column(Float, default=0, nullable=False)     # signed
    created_at = Column(DateTime, default=datetime.utcnow)

    invoice = relationship("Invoice", back_populates="lines")
    timesheet = relationship("Timesheet", foreign_keys=[timesheet_id])


class InvoiceAudit(Base):
    __tablename__ = "invoice_audits"
    id = Column(String, primary_key=True, default=lambda: gen_id("IAU"))
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False, index=True)
    actor_role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    invoice = relationship("Invoice", back_populates="audits")
