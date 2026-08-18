import enum
import uuid
from datetime import datetime, date

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Date,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
    Text,
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
    bill_rate = Column(Float, nullable=False)
    currency = Column(String, default="INR", nullable=False)
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.OPEN, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="projects")
    assignments = relationship("Assignment", back_populates="project")


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
