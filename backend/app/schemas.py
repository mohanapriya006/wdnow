from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models import UserRole, VendorStatus, ContractorStatus, AssignmentStatus, ProjectStatus, MilestoneStatus, TimesheetStatus, TimesheetPriority


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
    bill_rate: float = Field(gt=0)
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
    bill_rate: Optional[float] = Field(default=None, gt=0)
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
    bill_rate: float
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
    work_date: date
    clock_in: Optional[str] = None
    clock_out: Optional[str] = None
    manual_hours: Optional[float] = Field(default=None, gt=0, le=24)
    break_minutes: int = Field(default=0, ge=0, le=720)
    milestone_id: Optional[str] = None
    work_location: Optional[str] = None
    notes: Optional[str] = None


class TimeEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    work_date: date
    milestone_id: Optional[str] = None
    milestone_name: Optional[str] = None
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


class TimesheetOut(BaseModel):
    id: str
    assignment_id: str
    project_id: Optional[str] = None
    project_name: str
    contractor_name: str
    week_start: date
    week_end: date
    status: TimesheetStatus
    contractor_summary: Optional[str] = None
    vendor_comment: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    regular_hours: float = 0
    overtime_hours: float = 0
    total_hours: float = 0
    compensation: float = 0
    entries: List[TimeEntryOut] = []
    audit_history: List[str] = []


class TimesheetSubmit(BaseModel):
    contractor_summary: Optional[str] = None


class TimesheetReview(BaseModel):
    action: str = Field(pattern="^(APPROVE|FLAG)$")
    comment: Optional[str] = None
    entry_id: Optional[str] = None


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


class ContractorAssignmentOut(BaseModel):
    has_assignment: bool
    assignment: Optional[ContractorAssignmentView] = None
