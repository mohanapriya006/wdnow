from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_vendor
from app.models import Vendor, Contractor, Assignment, AssignmentStatus, ContractorStatus
from app.schemas import VendorOut, VendorUpdate, VendorDashboardOut

router = APIRouter(prefix="/api/vendors", tags=["vendors"])


def _get_vendor_or_404(db: Session, vendor_id: str) -> Vendor:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found.")
    return vendor


@router.get("/me", response_model=VendorOut)
def get_my_vendor_profile(
    current_user: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    # vendor_id comes only from the verified JWT — never from client input.
    return _get_vendor_or_404(db, current_user.vendor_id)


@router.patch("/me", response_model=VendorOut)
def update_my_vendor_profile(
    payload: VendorUpdate,
    current_user: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    vendor = _get_vendor_or_404(db, current_user.vendor_id)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vendor, field, value)

    db.commit()
    db.refresh(vendor)
    return vendor


@router.get("/me/dashboard", response_model=VendorDashboardOut)
def get_my_dashboard(
    current_user: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    vendor = _get_vendor_or_404(db, current_user.vendor_id)

    total_contractors = db.query(Contractor).filter(Contractor.vendor_id == vendor.id).count()
    active_contractors = (
        db.query(Contractor)
        .filter(Contractor.vendor_id == vendor.id, Contractor.status == ContractorStatus.ACTIVE)
        .count()
    )
    total_assignments = db.query(Assignment).filter(Assignment.vendor_id == vendor.id).count()
    active_assignments = (
        db.query(Assignment)
        .filter(Assignment.vendor_id == vendor.id, Assignment.status == AssignmentStatus.ACTIVE)
        .count()
    )

    return VendorDashboardOut(
        vendor=vendor,
        active_contractors_count=active_contractors,
        active_assignments_count=active_assignments,
        total_contractors_count=total_contractors,
        total_assignments_count=total_assignments,
        pending_timesheets_count=0,
        pending_invoices_count=0,
    )
