from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import Notification, NotificationCategory, User
from app.schemas import NotificationOut, NotificationListOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def push_notification(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    category: NotificationCategory = NotificationCategory.SYSTEM,
    link_url: Optional[str] = None,
) -> Optional[Notification]:
    """Helper to persist an in-app notification for a given user."""
    if not user_id:
        return None
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        category=category,
        link_url=link_url,
        is_read=0,
    )
    db.add(notif)
    return notif


def push_notification_for_contractor(
    db: Session,
    contractor_id: str,
    title: str,
    message: str,
    category: NotificationCategory = NotificationCategory.SYSTEM,
    link_url: Optional[str] = None,
) -> Optional[Notification]:
    """Finds user associated with contractor_id and pushes a notification."""
    user = db.query(User).filter(User.contractor_id == contractor_id).first()
    if user:
        return push_notification(db, user.id, title, message, category, link_url)
    return None


def push_notification_for_vendor(
    db: Session,
    vendor_id: str,
    title: str,
    message: str,
    category: NotificationCategory = NotificationCategory.SYSTEM,
    link_url: Optional[str] = None,
) -> Optional[Notification]:
    """Finds user associated with vendor_id and pushes a notification."""
    user = db.query(User).filter(User.vendor_id == vendor_id).first()
    if user:
        return push_notification(db, user.id, title, message, category, link_url)
    return None


@router.get("", response_model=NotificationListOut)
def list_my_notifications(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current.user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    unread = sum(1 for n in notifs if n.is_read == 0)
    return NotificationListOut(
        unread_count=unread,
        total_count=len(notifs),
        items=notifs,
    )


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_as_read(
    notification_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current.user_id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    notif.is_read = 1
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/read-all", response_model=NotificationListOut)
def mark_all_notifications_as_read(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current.user_id,
        Notification.is_read == 0,
    ).update({"is_read": 1})
    db.commit()

    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current.user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return NotificationListOut(
        unread_count=0,
        total_count=len(notifs),
        items=notifs,
    )
