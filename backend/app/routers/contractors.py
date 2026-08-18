from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import (
    CurrentUser,
    get_current_user,
    require_vendor,
    require_contractor,
    assert_vendor_owns_contractor,
)
from app.models import (
    Contractor,
    User,
    UserRole,
    ContractorStatus,
    Assignment,
    AssignmentStatus,
)
from app.schemas import (
    ContractorCreate,
    ContractorOut,
    ContractorWithAssignmentStatus,
    ContractorMeOut,
    ContractorAssignmentOut,
    ContractorAssignmentView,
)
from app.security import hash_password

router = APIRouter(tags=["contractors"])

DEFAULT_CONTRACTOR_PASSWORD = "Contractor@123"


# ---------------------------------------------------------------------------
# Vendor-scoped contractor management
# ---------------------------------------------------------------------------

@router.get("/api/vendors/me/contractors", response_model=List[ContractorWithAssignmentStatus])
def list_my_contractors(
    current_user: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    contractors = (
        db.query(Contractor)
        .filter(Contractor.vendor_id == current_user.vendor_id)
        .order_by(Contractor.created_at.desc())
        .all()
    )

    results = []
    for c in contractors:
        latest_assignment = (
            db.query(Assignment)
            .filter(Assignment.contractor_id == c.id)
            .order_by(Assignment.created_at.desc())
            .first()
        )
        results.append(
            ContractorWithAssignmentStatus(
                **ContractorOut.model_validate(c).model_dump(),
                current_assignment_status=latest_assignment.status if latest_assignment else None,
                current_assignment_project=latest_assignment.project_name if latest_assignment else None,
            )
        )
    return results


@router.post(
    "/api/vendors/me/contractors",
    response_model=ContractorOut,
    status_code=status.HTTP_201_CREATED,
)
def add_contractor(
    payload: ContractorCreate,
    current_user: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    # vendor_id is ALWAYS derived from the authenticated JWT, never from the request body.
    contractor = Contractor(
        vendor_id=current_user.vendor_id,
        name=payload.name,
        email=payload.email.lower(),
        phone=payload.phone,
        skills=payload.skills,
        experience=payload.experience,
        location=payload.location,
        status=ContractorStatus.BENCH,
    )
    db.add(contractor)
    db.flush()  # get contractor.id without committing yet

    contractor_user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password or DEFAULT_CONTRACTOR_PASSWORD),
        role=UserRole.CONTRACTOR,
        vendor_id=current_user.vendor_id,
        contractor_id=contractor.id,
    )
    db.add(contractor_user)

    db.commit()
    db.refresh(contractor)
    return contractor


# ---------------------------------------------------------------------------
# Contractor "self" endpoints
# (Must be defined BEFORE /api/contractors/{contractor_id} to avoid shadowing)
# ---------------------------------------------------------------------------

@router.get("/api/contractors/me", response_model=ContractorMeOut)
def get_my_contractor_profile(
    current_user: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    contractor = db.query(Contractor).filter(Contractor.id == current_user.contractor_id).first()
    if not contractor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contractor profile not found.")

    return ContractorMeOut(
        **ContractorOut.model_validate(contractor).model_dump(),
        vendor_name=contractor.vendor.name if contractor.vendor else "",
    )


@router.get("/api/contractors/me/assignment", response_model=ContractorAssignmentOut)
def get_my_assignment(
    current_user: CurrentUser = Depends(require_contractor),
    db: Session = Depends(get_db),
):
    # Only ever query by the contractor_id embedded in the verified JWT.
    assignment = (
        db.query(Assignment)
        .filter(Assignment.contractor_id == current_user.contractor_id)
        .filter(Assignment.status.in_([AssignmentStatus.ACTIVE, AssignmentStatus.DRAFT]))
        .order_by(Assignment.created_at.desc())
        .first()
    )

    if not assignment:
        return ContractorAssignmentOut(has_assignment=False, assignment=None)

    view = ContractorAssignmentView(
        id=assignment.id,
        project_name=assignment.project_name,
        role=assignment.role,
        vendor_name=assignment.vendor.name,
        start_date=assignment.start_date,
        end_date=assignment.end_date,
        working_hours=assignment.working_hours,
        pay_rate=assignment.pay_rate,
        currency=assignment.currency,
        status=assignment.status,
        created_at=assignment.created_at,
    )
    return ContractorAssignmentOut(has_assignment=True, assignment=view)


# ---------------------------------------------------------------------------
# Contractor detail by ID
# ---------------------------------------------------------------------------

@router.get("/api/contractors/{contractor_id}", response_model=ContractorOut)
def get_contractor(
    contractor_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contractor = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not contractor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contractor not found.")

    if current_user.role == UserRole.VENDOR:
        assert_vendor_owns_contractor(current_user.vendor_id, contractor.vendor_id)
    elif current_user.role == UserRole.CONTRACTOR:
        if current_user.contractor_id != contractor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You may only view your own contractor profile.",
            )
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

    return contractor

