import logging
import re
from typing import Optional
from twilio.rest import Client
from app.config import settings

logger = logging.getLogger(__name__)


def normalize_phone_number(phone: str) -> str:
    """
    Normalizes phone string to E.164 standard format.
    Defaults to +91 country code if 10 digits are provided without international prefix.
    """
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    if cleaned.startswith("+"):
        return cleaned
    # If 10 digits (India mobile format)
    if len(cleaned) == 10:
        return f"+91{cleaned}"
    # If 12 digits starting with 91
    if len(cleaned) == 12 and cleaned.startswith("91"):
        return f"+{cleaned}"
    # If 11 digits starting with 1 (US format)
    if len(cleaned) == 11 and cleaned.startswith("1"):
        return f"+{cleaned}"
    return f"+{cleaned}"


def send_sms_notification(to_phone: str, message_body: str) -> dict:
    """
    Sends an SMS using Twilio REST API.
    Handles standard SMS delivery with automatic fallback for trial accounts requiring templates.
    """
    if not settings.TWILIO_ENABLED:
        logger.info(f"[Twilio Disabled] Simulated SMS to {to_phone}: {message_body}")
        return {"success": True, "simulated": True, "sid": "SIMULATED_SID"}

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_FROM_PHONE:
        logger.warning(f"[Twilio Config Missing] Cannot send SMS to {to_phone}. Message: {message_body}")
        return {"success": False, "error": "Twilio configuration credentials missing"}

    formatted_to = normalize_phone_number(to_phone)
    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

    # If trial template mode is explicitly enabled
    body_to_send = "sms_account_alerts" if settings.TWILIO_USE_TRIAL_TEMPLATE else message_body

    try:
        message = client.messages.create(
            to=formatted_to,
            from_=settings.TWILIO_FROM_PHONE,
            body=body_to_send,
        )
        logger.info(f"Twilio SMS sent to {formatted_to} successfully. SID: {message.sid}")
        return {"success": True, "sid": message.sid, "status": message.status}
    except Exception as exc:
        err_msg = str(exc)
        logger.warning(f"Initial Twilio SMS send failed for {formatted_to}: {err_msg}")
        
        # If trial account template restriction was encountered, retry with trial template keyword
        if "Invalid template name" in err_msg or "Trial accounts can only use predefined SMS templates" in err_msg:
            try:
                logger.info(f"Retrying Twilio SMS with trial template for {formatted_to}...")
                fallback_msg = client.messages.create(
                    to=formatted_to,
                    from_=settings.TWILIO_FROM_PHONE,
                    body="sms_account_alerts",
                )
                logger.info(f"Twilio trial template SMS sent successfully to {formatted_to}. SID: {fallback_msg.sid}")
                return {"success": True, "sid": fallback_msg.sid, "status": fallback_msg.status, "trial_template_used": True}
            except Exception as retry_exc:
                logger.error(f"Fallback trial template SMS also failed: {retry_exc}")
                return {"success": False, "error": str(retry_exc)}

        return {"success": False, "error": err_msg}


def send_contractor_assignment_sms(
    contractor_name: str,
    contractor_phone: Optional[str],
    project_name: str,
    role: str,
    vendor_name: str,
    pay_rate: float,
    currency: str,
    start_date: str,
) -> dict:
    """
    Sends an assignment notification SMS to the contractor when placed on a project.
    """
    if not contractor_phone:
        logger.info(f"Contractor '{contractor_name}' has no phone number. Skipping SMS.")
        return {"success": False, "error": "No phone number provided for contractor"}

    body = (
        f"Hi {contractor_name}, you have been assigned to project '{project_name}' as '{role}' "
        f"by {vendor_name}. Pay rate: {currency} {pay_rate:,.2f}/hr, Starting: {start_date}. "
        f"Log in to VNDLY CWM to view your dashboard."
    )
    return send_sms_notification(to_phone=contractor_phone, message_body=body)
