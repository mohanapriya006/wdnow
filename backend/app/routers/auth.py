from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse
from app.security import verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
