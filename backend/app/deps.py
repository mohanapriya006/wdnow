from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import decode_access_token
from app.models import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


@dataclass
class CurrentUser:
    """Represents the identity carried inside a validated JWT.

    This is the single source of truth for "who is calling the API" used by
    every route. Nothing here is ever taken from request bodies or query
    params — only from the cryptographically verified token.
    """

    user_id: str
    role: UserRole
    vendor_id: Optional[str] = None
    contractor_id: Optional[str] = None


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise credentials_exception

    user_id: str = payload.get("sub")
    role: str = payload.get("role")
    if not user_id or not role:
        raise credentials_exception

    return CurrentUser(
        user_id=user_id,
        role=UserRole(role),
        vendor_id=payload.get("vendor_id"),
        contractor_id=payload.get("contractor_id"),
    )


def require_vendor(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Blocks any non-vendor caller. Contractors get a 403, never vendor data."""
    if current_user.role != UserRole.VENDOR or not current_user.vendor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires a VENDOR account.",
        )
    return current_user


def require_contractor(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Blocks any non-contractor caller."""
    if current_user.role != UserRole.CONTRACTOR or not current_user.contractor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires a CONTRACTOR account.",
        )
    return current_user


def assert_vendor_owns_contractor(vendor_id: str, contractor_vendor_id: str) -> None:
    """Ownership check: a vendor may only touch contractors that belong to them."""
    if vendor_id != contractor_vendor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this contractor.",
        )


def assert_vendor_owns_assignment(vendor_id: str, assignment_vendor_id: str) -> None:
    if vendor_id != assignment_vendor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this assignment.",
        )


def assert_contractor_owns_assignment(contractor_id: str, assignment_contractor_id: str) -> None:
    if contractor_id != assignment_contractor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this assignment.",
        )
