from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import User, Vendor, Contractor, UserRole, VendorStatus, ContractorStatus
from app.schemas import (
    LoginRequest,
    TokenResponse,
    VendorRegisterRequest,
    ContractorRegisterRequest,
    VendorPublicOut,
    UserMeOut,
)
from app.security import verify_password, create_access_token, hash_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/vendors", response_model=List[VendorPublicOut])
def list_public_vendors(db: Session = Depends(get_db)):
    """Public list of active staffing agencies/vendors for contractor registration dropdown."""
    vendors = db.query(Vendor).filter(Vendor.status == VendorStatus.ACTIVE).order_by(Vendor.name.asc()).all()
    return vendors


@router.post("/register/vendor", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_vendor(payload: VendorRegisterRequest, db: Session = Depends(get_db)):
    if payload.confirm_password and payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    # Check if vendor with email already exists
    existing_vendor = db.query(Vendor).filter(Vendor.email == payload.email.lower()).first()
    if existing_vendor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A vendor with this email already exists.",
        )

    # Create Vendor
    vendor = Vendor(
        name=payload.company_name.strip(),
        email=payload.email.lower(),
        phone=payload.phone.strip() if payload.phone else None,
        address=payload.address.strip() if payload.address else None,
        status=VendorStatus.ACTIVE,
    )
    db.add(vendor)
    db.flush()

    # Create User
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=UserRole.VENDOR,
        vendor_id=vendor.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create JWT
    token_data = {
        "sub": user.id,
        "role": user.role.value,
        "vendor_id": user.vendor_id,
        "contractor_id": None,
    }
    access_token = create_access_token(token_data)

    return TokenResponse(
        access_token=access_token,
        role=user.role,
        user_id=user.id,
        vendor_id=user.vendor_id,
        contractor_id=None,
        name=vendor.name,
    )


@router.post("/register/contractor", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_contractor(payload: ContractorRegisterRequest, db: Session = Depends(get_db)):
    if payload.confirm_password and payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    # Verify chosen vendor exists
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected staffing agency/vendor does not exist.",
        )

    # Check if user with email already exists
    existing_user = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    # Check if contractor with email already exists
    existing_contractor = db.query(Contractor).filter(Contractor.email == payload.email.lower()).first()
    if existing_contractor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A contractor with this email already exists.",
        )

    # Create Contractor (status is automatically BENCH)
    contractor = Contractor(
        vendor_id=vendor.id,
        name=payload.name.strip(),
        email=payload.email.lower(),
        phone=payload.phone.strip() if payload.phone else None,
        skills=payload.skills.strip() if payload.skills else None,
        experience=payload.experience.strip() if payload.experience else None,
        location=payload.location.strip() if payload.location else None,
        status=ContractorStatus.BENCH,
    )
    db.add(contractor)
    db.flush()

    # Create User
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=UserRole.CONTRACTOR,
        vendor_id=vendor.id,
        contractor_id=contractor.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token_data = {
        "sub": user.id,
        "role": user.role.value,
        "vendor_id": user.vendor_id,
        "contractor_id": user.contractor_id,
    }
    access_token = create_access_token(token_data)

    return TokenResponse(
        access_token=access_token,
        role=user.role,
        user_id=user.id,
        vendor_id=user.vendor_id,
        contractor_id=user.contractor_id,
        name=contractor.name,
    )


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
    if user.role == UserRole.CONTRACTOR and user.contractor:
        display_name = user.contractor.name
    elif user.role == UserRole.VENDOR and user.vendor:
        display_name = user.vendor.name
    elif user.vendor:
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


@router.get("/me", response_model=UserMeOut)
def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == current_user.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    display_name = user.email
    if user.role == UserRole.CONTRACTOR and user.contractor:
        display_name = user.contractor.name
    elif user.role == UserRole.VENDOR and user.vendor:
        display_name = user.vendor.name
    elif user.vendor:
        display_name = user.vendor.name
    elif user.contractor:
        display_name = user.contractor.name

    return UserMeOut(
        id=user.id,
        email=user.email,
        role=user.role,
        vendor_id=user.vendor_id,
        contractor_id=user.contractor_id,
        name=display_name,
    )
