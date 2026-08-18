from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Vendor, Contractor, UserRole, ContractorStatus, VendorStatus
from app.schemas import LoginRequest, TokenResponse, ContractorRegistration, ContractorOut
from app.security import verify_password, create_access_token, hash_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register/contractor", response_model=ContractorOut, status_code=status.HTTP_201_CREATED)
def register_contractor(payload: ContractorRegistration, db: Session = Depends(get_db)):
    """Self-registration is intentionally contractor-only and tenant-scoped.

    This implementation has one existing seeded vendor program; the server,
    not the browser, determines that membership. Multi-vendor onboarding can
    later replace this lookup with a signed invitation code.
    """
    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with this email already exists.")
    vendor = db.query(Vendor).filter(Vendor.status == VendorStatus.ACTIVE).order_by(Vendor.created_at).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Contractor registration is unavailable until the vendor program is configured.")
    contractor = Contractor(vendor_id=vendor.id, name=payload.name, email=email,
                            phone=payload.phone, skills=payload.skills, experience=payload.experience,
                            location=payload.location, status=ContractorStatus.BENCH)
    db.add(contractor)
    db.flush()
    db.add(User(email=email, password_hash=hash_password(payload.password), role=UserRole.CONTRACTOR,
                vendor_id=vendor.id, contractor_id=contractor.id))
    db.commit()
    db.refresh(contractor)
    return contractor


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token_data = {
        "sub": user.id,
        "role": user.role.value,
        "vendor_id": user.vendor_id,
        "contractor_id": user.contractor_id,
    }
    access_token = create_access_token(token_data)

    display_name = user.email
    if user.vendor:
        display_name = user.vendor.name
    elif user.contractor:
        display_name = user.contractor.name

    return TokenResponse(
        access_token=access_token,
        role=user.role,
        user_id=user.id,
        vendor_id=user.vendor_id,
        contractor_id=user.contractor_id,
        name=display_name,
    )
