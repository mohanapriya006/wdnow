from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models import (
    UserRole, VendorStatus, ContractorStatus, AssignmentStatus, ProjectStatus,
    MilestoneStatus, TimesheetStatus, TimesheetPriority, InvoiceStatus,
    InvoiceLineType, TaxRuleType,
)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ContractorRegistration(BaseModel):
    """Public onboarding for the single existing vendor program."""
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: Optional[str] = None
    skills: Optional[str] = None
    experience: Optional[str] = None
    location: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: str
    vendor_id: Optional[str] = None
    contractor_id: Optional[str] = None
    name: str


# ---------------------------------------------------------------------------
# Vendor
# ---------------------------------------------------------------------------

class VendorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    status: VendorStatus
    created_at: datetime


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None


class VendorDashboardOut(BaseModel):
    vendor: VendorOut
    active_contractors_count: int
    active_assignments_count: int
    total_contractors_count: int
    total_assignments_count: int
    pending_timesheets_count: int = 0
    pending_invoices_count: int = 0


# ---------------------------------------------------------------------------
# Contractor
# ---------------------------------------------------------------------------

class ContractorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = None
    skills: Optional[str] = None
    experience: Optional[str] = None
    location: Optional[str] = None
    password: Optional[str] = Field(
        default=None,
        description="Optional initial password for the contractor's login account. "
                    "If omitted, a default demo password is set.",
    )


class ContractorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    skills: Optional[str] = None
    experience: Optional[str] = None
    location: Optional[str] = None
    status: ContractorStatus
    created_at: datetime


class ContractorWithAssignmentStatus(ContractorOut):
    current_assignment_status: Optional[AssignmentStatus] = None
    current_assignment_project: Optional[str] = None


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------
class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = None
    role: str = Field(min_length=2, max_length=120)
    required_skills: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    location: Optional[str] = None
    work_mode: str = Field(default="REMOTE", max_length=30)
    working_hours: int = Field(default=40, ge=1, le=168)
    pay_rate: float = Field(gt=0)
    currency: str = "INR"
    status: ProjectStatus = ProjectStatus.OPEN


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = None
    role: Optional[str] = Field(default=None, min_length=2, max_length=120)
    required_skills: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    location: Optional[str] = None
    work_mode: Optional[str] = None
    working_hours: Optional[int] = Field(default=None, ge=1, le=168)
    pay_rate: Optional[float] = Field(default=None, gt=0)
    currency: Optional[str] = None
    status: Optional[ProjectStatus] = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    vendor_id: str
    name: str
    description: Optional[str] = None
    role: str
    required_skills: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    location: Optional[str] = None
    work_mode: str
    working_hours: int
    pay_rate: float
    currency: str
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
    assigned_contractors_count: int = 0


class MilestoneCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    start_date: date
    due_date: date
    description: Optional[str] = None
    priority: TimesheetPriority = TimesheetPriority.MEDIUM
    status: MilestoneStatus = MilestoneStatus.UPCOMING


class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    description: Optional[str] = None
    priority: Optional[TimesheetPriority] = None
    status: Optional[MilestoneStatus] = None


class MilestoneOut(MilestoneCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Assignment
# ---------------------------------------------------------------------------

class AssignmentCreate(BaseModel):
    contractor_id: str
    project_id: str
    # Assignment dates are distinct from the project's planned dates.
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None


class AssignmentUpdate(BaseModel):
    project_name: Optional[str] = None
    role: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    working_hours: Optional[int] = Field(default=None, ge=1, le=168)
    pay_rate: Optional[float] = Field(default=None, gt=0)
    bill_rate: Optional[float] = Field(default=None, gt=0)
    status: Optional[AssignmentStatus] = None
    notes: Optional[str] = None


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    contractor_id: str
    project_id: Optional[str] = None
    project_name: str
    role: str
    start_date: date
    end_date: Optional[date] = None
    working_hours: int
    pay_rate: float
    bill_rate: float
    currency: str
    status: AssignmentStatus
    notes: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[str] = None
    location: Optional[str] = None
    work_mode: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AssignmentDetailOut(AssignmentOut):
    contractor_name: Optional[str] = None
    vendor_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Contractor "me" views
# ---------------------------------------------------------------------------

class ContractorMeOut(ContractorOut):
    vendor_name: str


class ContractorAssignmentView(BaseModel):
    """Assignment as seen by the CONTRACTOR themselves.

    Deliberately omits bill_rate: in a real VMS, the rate billed to the end
    client is commercial information between the vendor and the client, and
    is not exposed to the contractor — only their own pay rate is.
    """

    id: str
    project_name: str
    role: str
    vendor_name: str
    start_date: date
    end_date: Optional[date] = None
    working_hours: int
    pay_rate: float
    currency: str
    status: AssignmentStatus
    created_at: datetime
    description: Optional[str] = None
    required_skills: Optional[str] = None
    location: Optional[str] = None
    work_mode: Optional[str] = None


# ---------------------------------------------------------------------------
# Timesheets
# ---------------------------------------------------------------------------
class TimeEntryCreate(BaseModel):
    """A single day of work.

    The contractor supplies start and end time; the backend derives the hours.
    ``manual_hours`` is retained for backwards compatibility with existing API
    clients but start/end time is the supported path.
    """
    work_date: date
    #: Which assignment this day belongs to. Omit to use the active assignment;
    #: required in practice only when a contractor holds more than one.
    assignment_id: Optional[str] = None
    start_time: Optional[str] = Field(default=None, description="HH:MM, 24-hour")
    end_time: Optional[str] = Field(default=None, description="HH:MM, 24-hour")
    clock_in: Optional[str] = None   # legacy alias for start_time
    clock_out: Optional[str] = None  # legacy alias for end_time
    manual_hours: Optional[float] = Field(default=None, gt=0, le=24)
    break_minutes: int = Field(default=0, ge=0, le=720)
    # No milestone_id: milestones are vendor-only, so a contractor cannot attribute
    # time to one. The stored column is still surfaced on the vendor's views.
    work_location: Optional[str] = None
    notes: Optional[str] = None


class OverlapAssignmentOut(BaseModel):
    """One side of an overlapping pair, as shown on the review timeline."""
    project: str
    assignment_id: Optional[str] = None
    start: str
    end: str


class AnomalyOut(BaseModel):
    """One detected problem, always carrying its own explanation.

    Cross-assignment findings add the evidence the vendor needs to judge them:
    the hours reported, the ceiling that was breached, the projects involved and
    the exact overlapping windows.
    """
    type: str
    severity: str
    date: date
    hours: float = 0
    reason: str
    reported_hours: Optional[float] = None
    maximum_hours: Optional[float] = None
    overlap_hours: Optional[float] = None
    projects: List[str] = []
    assignments: List[OverlapAssignmentOut] = []
    assignment_id: Optional[str] = None


class TimeEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    work_date: date
    milestone_id: Optional[str] = None
    milestone_name: Optional[str] = None
    # start_time / end_time mirror clock_in / clock_out under the names the
    # Timesheet UI uses. worked_hours is deliberately not exposed.
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    clock_in: Optional[str] = None
    clock_out: Optional[str] = None
    break_minutes: int
    regular_hours: float
    overtime_hours: float
    total_hours: float
    work_location: Optional[str] = None
    notes: Optional[str] = None
    is_flagged: int
    flag_reason: Optional[str] = None
    is_holiday: bool = False
    holiday_name: Optional[str] = None
    has_anomaly: bool = False
    anomaly_severity: Optional[str] = None
    anomalies: List[AnomalyOut] = []


class TimesheetOut(BaseModel):
    id: str
    assignment_id: str
    project_id: Optional[str] = None
    project_name: str
    contractor_id: str
    contractor_name: str
    week_start: date
    week_end: date
    status: TimesheetStatus
    #: PENDING / APPROVED / REJECTED / DRAFT as shown to the contractor.
    display_status: str = "DRAFT"
    contractor_summary: Optional[str] = None
    vendor_comment: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    weekly_capacity: int = 40
    regular_hours: float = 0
    overtime_hours: float = 0
    total_hours: float = 0
    compensation: float = 0
    currency: str = "INR"
    days_logged: int = 0
    has_anomalies: bool = False
    anomaly_count: int = 0
    anomaly_severity: Optional[str] = None
    #: FLAGGED / WARNING / CLEAN, derived from the highest severity found.
    flag_status: str = "CLEAN"
    #: One line the vendor can read without opening the timesheet.
    flag_reason: Optional[str] = None
    anomalies: List[AnomalyOut] = []
    entries: List[TimeEntryOut] = []
    audit_history: List[str] = []


class TimesheetSubmit(BaseModel):
    contractor_summary: Optional[str] = None


class TimesheetReview(BaseModel):
    """Vendor decision on a weekly report.

    REJECT and REQUEST_CORRECTION both require a reason. REQUEST_CORRECTION
    returns the week to the contractor as a draft they can edit and resubmit,
    without recording a rejection against it.
    """
    action: str = Field(pattern="^(APPROVE|REJECT|REQUEST_CORRECTION|FLAG)$")
    reason: Optional[str] = None
    comment: Optional[str] = None  # legacy alias for reason
    entry_id: Optional[str] = None


class ContractorTimesheetSummary(BaseModel):
    """One contractor inside a project, for the vendor drill-down."""
    contractor_id: str
    contractor_name: str
    assignment_id: str
    role: str
    weekly_capacity: int
    total_weeks: int
    normal_reports: int
    anomaly_reports: int
    pending_reports: int
    approved_reports: int
    rejected_reports: int
    total_hours: float
    approved_hours: float
    last_submitted_at: Optional[datetime] = None


class ProjectTimesheetAnalytics(BaseModel):
    project_id: str
    project_name: str
    total_contractors: int
    total_hours: float
    regular_hours: float
    overtime_hours: float
    approved_hours: float
    pending_hours: float
    labor_cost: float
    utilization: float
    timesheet_compliance: float
    anomaly_reports: int = 0
    pending_reports: int = 0


class ContractorAssignmentOut(BaseModel):
    has_assignment: bool
    assignment: Optional[ContractorAssignmentView] = None


# ---------------------------------------------------------------------------
# Contractor performance (analytical KPI - never alters a contractual rate)
# ---------------------------------------------------------------------------

class PerformanceComponentOut(BaseModel):
    key: str
    label: str
    weight: float
    #: 0-100, or null when the underlying data does not exist for this contractor.
    value: Optional[float] = None
    #: Share of the final score this component actually carried.
    applied_weight: float = 0
    detail: str


class PerformanceScoreOut(BaseModel):
    contractor_id: str
    contractor_name: Optional[str] = None
    score: Optional[float] = None
    band: str
    components: List[PerformanceComponentOut] = []
    reports_considered: int = 0
    calculated_at: datetime


# ---------------------------------------------------------------------------
# Invoicing
# ---------------------------------------------------------------------------

class InvoiceTaxRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: str
    label: str
    rule_type: TaxRuleType
    rate_percent: float
    is_active: bool
    sort_order: int


class InvoiceTaxRuleUpsert(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    label: str = Field(min_length=1, max_length=120)
    rule_type: TaxRuleType
    rate_percent: float = Field(ge=0, le=100)
    is_active: bool = True
    sort_order: int = 0


class InvoiceLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    line_type: InvoiceLineType
    description: str
    week_start: Optional[date] = None
    week_end: Optional[date] = None
    quantity: float
    rate: float
    amount: float
    timesheet_id: Optional[str] = None


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    invoice_number: str
    vendor_id: str
    vendor_name: Optional[str] = None
    contractor_id: str
    contractor_name: Optional[str] = None
    assignment_id: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    role: Optional[str] = None

    period_start: date
    period_end: date
    invoice_date: date
    due_date: date
    currency: str

    regular_hours: float
    overtime_hours: float
    total_hours: float
    hourly_rate: float
    overtime_multiplier: float

    base_amount: float
    overtime_amount: float
    gross_amount: float
    taxable_amount: float
    tax_amount: float
    deduction_amount: float
    adjustment_amount: float
    net_payable: float

    performance_score: Optional[float] = None
    performance_adjusted_amount: Optional[float] = None

    status: InvoiceStatus
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_date: Optional[date] = None

    is_overdue: bool = False
    weeks_billed: int = 0

    generated_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    created_at: datetime

    lines: List[InvoiceLineOut] = []
    audit_history: List[str] = []


class BillableWeekOut(BaseModel):
    """One approved, un-invoiced weekly report awaiting billing."""
    timesheet_id: str
    week_start: date
    week_end: date
    regular_hours: float
    overtime_hours: float
    total_hours: float
    approved_at: Optional[datetime] = None
    had_anomalies: bool = False


class BillableAssignmentOut(BaseModel):
    """A contractor with approved hours ready to invoice."""
    assignment_id: str
    contractor_id: str
    contractor_name: str
    project_id: Optional[str] = None
    project_name: str
    role: str
    currency: str
    hourly_rate: float
    weekly_capacity: int
    weeks: List[BillableWeekOut] = []
    regular_hours: float = 0
    overtime_hours: float = 0
    total_hours: float = 0
    estimated_gross: float = 0
    estimated_net: float = 0
    performance_score: Optional[float] = None
    earliest_week: Optional[date] = None
    latest_week: Optional[date] = None


class InvoicePreviewRequest(BaseModel):
    """Review an invoice before it is generated. Nothing is persisted."""
    assignment_id: str
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    adjustment_amount: float = 0
    adjustment_note: Optional[str] = None
    overtime_multiplier: Optional[float] = Field(default=None, ge=1, le=3)


class InvoiceGenerateRequest(InvoicePreviewRequest):
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None


class InvoicePreviewOut(BaseModel):
    """Server-calculated preview. The same engine produces the stored invoice."""
    assignment_id: str
    contractor_id: str
    contractor_name: str
    project_id: Optional[str] = None
    project_name: str
    currency: str
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    hourly_rate: float
    overtime_multiplier: float
    regular_hours: float
    overtime_hours: float
    total_hours: float
    base_amount: float
    overtime_amount: float
    gross_amount: float
    taxable_amount: float
    tax_amount: float
    deduction_amount: float
    adjustment_amount: float
    net_payable: float
    weeks_billed: int
    performance_score: Optional[float] = None
    performance_adjusted_amount: Optional[float] = None
    lines: List[InvoiceLineOut] = []
    warnings: List[str] = []


class InvoiceTransitionRequest(BaseModel):
    """Move an invoice along the lifecycle. REJECT always needs a reason."""
    action: str = Field(pattern="^(SUBMIT|APPROVE|REJECT|MARK_PAID)$")
    reason: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_date: Optional[date] = None


class InvoiceSummaryOut(BaseModel):
    """Headline financials for the vendor invoice dashboard."""
    total_invoices: int = 0
    generated_count: int = 0
    submitted_count: int = 0
    approved_count: int = 0
    paid_count: int = 0
    rejected_count: int = 0
    overdue_count: int = 0
    gross_total: float = 0
    tax_total: float = 0
    deduction_total: float = 0
    net_total: float = 0
    paid_total: float = 0
    outstanding_total: float = 0
    billable_contractors: int = 0
    billable_hours: float = 0
    billable_estimated_net: float = 0
    currency: str = "INR"


# ---------------------------------------------------------------------------
# Milestone analytics (vendor)
# ---------------------------------------------------------------------------

class MilestoneRowOut(BaseModel):
    id: str
    project_id: str
    project_name: str
    name: str
    description: Optional[str] = None
    start_date: date
    due_date: date
    completed_at: Optional[date] = None
    priority: TimesheetPriority
    status: MilestoneStatus
    #: Negative = delivered early, positive = late. Null while still open.
    variance_days: Optional[int] = None
    days_to_due: Optional[int] = None
    is_overdue: bool = False
    risk: str = "ON_TRACK"
    assigned_contractors: List[str] = []
    logged_hours: float = 0


class ProjectMilestoneProgressOut(BaseModel):
    project_id: str
    project_name: str
    project_status: ProjectStatus
    start_date: date
    end_date: Optional[date] = None
    total_milestones: int = 0
    completed: int = 0
    in_progress: int = 0
    upcoming: int = 0
    overdue: int = 0
    at_risk: int = 0
    completion_percent: float = 0
    on_time_percent: Optional[float] = None
    avg_variance_days: Optional[float] = None
    assigned_contractors: int = 0
    next_due: Optional[date] = None
    risk: str = "ON_TRACK"


class MilestoneDashboardOut(BaseModel):
    total_projects: int = 0
    total_milestones: int = 0
    completed: int = 0
    in_progress: int = 0
    upcoming: int = 0
    overdue: int = 0
    at_risk: int = 0
    completion_percent: float = 0
    on_time_percent: Optional[float] = None
    projects: List[ProjectMilestoneProgressOut] = []
    upcoming_deadlines: List[MilestoneRowOut] = []
    recent_activity: List[MilestoneRowOut] = []
    milestones: List[MilestoneRowOut] = []


# ---------------------------------------------------------------------------
# Contractor timesheet risk review (vendor)
# ---------------------------------------------------------------------------

class RiskDayEntryOut(BaseModel):
    """One assignment's block of time on a contested calendar day."""
    entry_id: str
    assignment_id: str
    project: str
    start: Optional[str] = None
    end: Optional[str] = None
    hours: float


class RiskOverlapOut(BaseModel):
    overlap_hours: float
    assignments: List[OverlapAssignmentOut] = []


class RiskDayOut(BaseModel):
    """A contractor's full calendar day, across every assignment."""
    date: date
    reported_hours: float
    maximum_hours: float
    projects: List[str] = []
    multi_project: bool = False
    entries: List[RiskDayEntryOut] = []
    overlaps: List[RiskOverlapOut] = []


class TimesheetRiskOut(BaseModel):
    """A timesheet as it appears in the vendor's risk review list."""
    timesheet_id: str
    contractor_id: str
    contractor_name: str
    project_id: Optional[str] = None
    project_name: str
    week_start: date
    week_end: date
    status: TimesheetStatus
    display_status: str
    submitted_at: Optional[datetime] = None
    total_hours: float = 0
    regular_hours: float = 0
    overtime_hours: float = 0
    #: FLAGGED / WARNING / CLEAN
    flag_status: str = "CLEAN"
    severity: Optional[str] = None
    anomaly_count: int = 0
    flag_reason: Optional[str] = None
    #: Every project this contractor touched during the week, across assignments.
    projects_involved: List[str] = []
    max_daily_hours: float = 0
    anomalies: List[AnomalyOut] = []
    days: List[RiskDayOut] = []


class TimesheetRiskSummaryOut(BaseModel):
    """Counts for the vendor dashboard risk panel."""
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    clean: int = 0
    flagged: int = 0
    warning: int = 0
    total: int = 0
    pending_review: int = 0


class TimesheetRiskBoardOut(BaseModel):
    summary: TimesheetRiskSummaryOut
    timesheets: List[TimesheetRiskOut] = []


# ---------------------------------------------------------------------------
# AI timesheet explanation
# ---------------------------------------------------------------------------

class TimesheetExplanationRequest(BaseModel):
    timesheet_id: str


class TimesheetExplanationOut(BaseModel):
    """Neutral, structured explanation of an already-detected anomaly."""
    risk_level: str
    title: str
    summary: str
    reasons: List[str] = []
    overlap_summary: Optional[str] = None
    recommendation: str
    disclaimer: str
    #: True when Gemini was unavailable and the deterministic fallback was used.
    generated_offline: bool = False
