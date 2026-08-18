from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import (
    CurrentUser,
    get_current_user,
    require_vendor,
    assert_vendor_owns_assignment,
    assert_contractor_owns_assignment,
)
from app.models import Assignment, Contractor, UserRole, ContractorStatus, AssignmentStatus
from app.schemas import AssignmentCreate, AssignmentUpdate, AssignmentOut, AssignmentDetailOut
from app.services.twilio_service import send_contractor_assignment_sms

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


def _to_detail(assignment: Assignment) -> AssignmentDetailOut:
    return AssignmentDetailOut(
        id=assignment.id,
        vendor_id=assignment.vendor_id,
        contractor_id=assignment.contractor_id,
        project_name=assignment.project_name,
        role=assignment.role,
        start_date=assignment.start_date,
        end_date=assignment.end_date,
        working_hours=assignment.working_hours,
        pay_rate=assignment.pay_rate,
        bill_rate=assignment.bill_rate,
        currency=assignment.currency,
        status=assignment.status,
        notes=assignment.notes,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
        contractor_name=assignment.contractor.name if assignment.contractor else None,
        vendor_name=assignment.vendor.name if assignment.vendor else None,
    )


@router.get("", response_model=List[AssignmentDetailOut])
def list_my_assignments(
    current_user: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    assignments = (
        db.query(Assignment)
        .filter(Assignment.vendor_id == current_user.vendor_id)
        .order_by(Assignment.created_at.desc())
        .all()
    )
    return [_to_detail(a) for a in assignments]


@router.post("", response_model=AssignmentDetailOut, status_code=status.HTTP_201_CREATED)
def create_assignment(
    payload: AssignmentCreate,
    current_user: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    contractor = db.query(Contractor).filter(Contractor.id == payload.contractor_id).first()
    if not contractor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contractor not found.")

    # Ownership check: vendor may only create assignments for their own contractors.
    assert_vendor_owns_assignment(current_user.vendor_id, contractor.vendor_id)

    if payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be before start date.",
        )
    if payload.bill_rate < payload.pay_rate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bill rate cannot be lower than pay rate.",
        )

    # vendor_id is ALWAYS derived from the authenticated JWT, never trusted from the client.
    assignment = Assignment(
        vendor_id=current_user.vendor_id,
        contractor_id=contractor.id,
        project_name=payload.project_name,
        role=payload.role,
        start_date=payload.start_date,
        end_date=payload.end_date,
        working_hours=payload.working_hours,
        pay_rate=payload.pay_rate,
        bill_rate=payload.bill_rate,
        currency=payload.currency,
        notes=payload.notes,
        status=AssignmentStatus.ACTIVE,
    )
    db.add(assignment)

    # Keep the contractor's headline status in sync with having a live assignment.
    contractor.status = ContractorStatus.ACTIVE

    db.commit()
    db.refresh(assignment)

    # Trigger Twilio SMS notification to contractor asynchronously/safely
    try:
        vendor_name = assignment.vendor.name if assignment.vendor else "Your Vendor"
        send_contractor_assignment_sms(
            contractor_name=contractor.name,
            contractor_phone=contractor.phone,
            project_name=assignment.project_name,
            role=assignment.role,
            vendor_name=vendor_name,
            pay_rate=assignment.pay_rate,
            currency=assignment.currency,
            start_date=str(assignment.start_date),
        )
    except Exception:
        pass

    return _to_detail(assignment)


@router.get("/{assignment_id}", response_model=AssignmentDetailOut)
def get_assignment(
    assignment_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    if current_user.role == UserRole.VENDOR:
        assert_vendor_owns_assignment(current_user.vendor_id, assignment.vendor_id)
    elif current_user.role == UserRole.CONTRACTOR:
        assert_contractor_owns_assignment(current_user.contractor_id, assignment.contractor_id)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

    return _to_detail(assignment)


@router.patch("/{assignment_id}", response_model=AssignmentDetailOut)
def update_assignment(
    assignment_id: str,
    payload: AssignmentUpdate,
    current_user: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    # Only the owning vendor may update — contractors can never modify rates/status.
    assert_vendor_owns_assignment(current_user.vendor_id, assignment.vendor_id)

    update_data = payload.model_dump(exclude_unset=True)

    new_start = update_data.get("start_date", assignment.start_date)
    new_end = update_data.get("end_date", assignment.end_date)
    if new_end and new_start and new_end < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be before start date.",
        )
    new_pay = update_data.get("pay_rate", assignment.pay_rate)
    new_bill = update_data.get("bill_rate", assignment.bill_rate)
    if new_bill < new_pay:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bill rate cannot be lower than pay rate.",
        )

    for field, value in update_data.items():
        setattr(assignment, field, value)

    # If the vendor marks the assignment COMPLETED/TERMINATED, free up the contractor.
    if assignment.status in (AssignmentStatus.COMPLETED, AssignmentStatus.TERMINATED):
        remaining_active = (
            db.query(Assignment)
            .filter(
                Assignment.contractor_id == assignment.contractor_id,
                Assignment.status == AssignmentStatus.ACTIVE,
                Assignment.id != assignment.id,
            )
            .count()
        )
        if remaining_active == 0 and assignment.contractor:
            assignment.contractor.status = ContractorStatus.BENCH
    elif assignment.status == AssignmentStatus.ACTIVE and assignment.contractor:
        assignment.contractor.status = ContractorStatus.ACTIVE

    db.commit()
    db.refresh(assignment)
    return _to_detail(assignment)
