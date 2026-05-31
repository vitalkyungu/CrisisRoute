"""Alert delivery — FCM push notifications and Twilio SMS fallback."""

import os
import re
from datetime import datetime, timezone

from firebase_admin import messaging

from src.services.firebase import get_db

_ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*m")


def _normalize_phone(phone: str) -> str:
    """Digits-only E.164-ish form for comparison."""
    return re.sub(r"\D", "", phone.strip())


def _twilio_configured() -> bool:
    return bool(
        os.getenv("TWILIO_ACCOUNT_SID")
        and os.getenv("TWILIO_AUTH_TOKEN")
        and os.getenv("TWILIO_PHONE_NUMBER")
    )


async def send_push_notification(
    fcm_token: str, title: str, body: str, data: dict | None = None
) -> dict:
    """Send FCM push notification to a volunteer's device."""
    message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        data=data or {},
        token=fcm_token,
    )
    response = messaging.send(message)
    return {"message_id": response, "channel": "fcm", "status": "sent"}


def _sms_recipient_error(phone: str) -> str | None:
    """Return a user-facing error if this number cannot receive SMS."""
    from_number = (os.getenv("TWILIO_PHONE_NUMBER") or "").strip()
    if not from_number:
        return None
    if _normalize_phone(phone) == _normalize_phone(from_number):
        return (
            "Profile phone cannot be the same as the Twilio sender number. "
            "Use your personal mobile number (E.164, e.g. +14155551234)."
        )
    return None


def _clean_sms_error(exc: Exception) -> str:
    """Strip Twilio CLI color codes and return a short message."""
    raw = _ANSI_ESCAPE.sub("", str(exc))
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("Unable to create record:"):
            return line
        if "Twilio returned the following information:" in raw:
            continue
    return raw.split("\n\n")[0].strip() or "SMS delivery failed"


async def send_sms_alert(phone: str, body: str) -> dict:
    """Send SMS via Twilio."""
    if not _twilio_configured():
        return {"error": "Twilio not configured", "channel": "sms", "status": "skipped"}

    recipient_error = _sms_recipient_error(phone)
    if recipient_error:
        return {"error": recipient_error, "channel": "sms", "status": "failed"}

    try:
        from twilio.rest import Client

        client = Client(
            os.getenv("TWILIO_ACCOUNT_SID"),
            os.getenv("TWILIO_AUTH_TOKEN"),
        )
        message = client.messages.create(
            body=body,
            from_=os.getenv("TWILIO_PHONE_NUMBER"),
            to=phone,
        )
        return {"message_sid": message.sid, "channel": "sms", "status": "sent"}
    except Exception as e:
        return {"error": _clean_sms_error(e), "channel": "sms", "status": "failed"}


async def send_welcome_sms(volunteer_id: str) -> dict:
    """Welcome text after volunteer completes profile setup."""
    db = get_db()
    doc = db.collection("volunteers").document(volunteer_id).get()
    if not doc.exists:
        return {"error": "Volunteer not found"}

    volunteer = doc.to_dict()
    phone = (volunteer.get("phone") or "").strip()
    if not phone:
        return {"error": "No phone number on profile", "status": "skipped"}

    name = volunteer.get("display_name") or "Volunteer"
    body = (
        f"Welcome to CrisisRoute, {name}! You're registered for disaster response missions. "
        f"We'll text you when you're assigned — keep this number reachable."
    )
    result = await send_sms_alert(phone, body)

    db.collection("alert_logs").add({
        "volunteer_id": volunteer_id,
        "mission_id": "",
        "channel": result.get("channel", "sms"),
        "status": result.get("status", "failed"),
        "alert_type": "welcome",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return result


async def send_mission_alert(
    volunteer_id: str, mission_id: str, briefing: str, translated_briefing: str
) -> dict:
    """Send mission briefing via FCM (primary) or SMS (fallback)."""
    db = get_db()
    vol_doc = db.collection("volunteers").document(volunteer_id).get()

    if not vol_doc.exists:
        return {"error": "Volunteer not found"}

    volunteer = vol_doc.to_dict()
    fcm_token = (volunteer.get("fcm_token") or "").strip()
    phone = (volunteer.get("phone") or "").strip()
    result: dict = {"channel": "none", "status": "no_contact_method"}

    if fcm_token:
        try:
            result = await send_push_notification(
                fcm_token=fcm_token,
                title="🚨 New Mission Assignment — CrisisRoute",
                body=translated_briefing[:200],
                data={"mission_id": mission_id, "type": "mission_assignment"},
            )
        except Exception as e:
            result = {"channel": "fcm", "status": "failed", "error": str(e)}

    if result.get("status") != "sent" and phone:
        sms_body = f"CrisisRoute Mission: {translated_briefing[:300]}"
        result = await send_sms_alert(phone, sms_body)
    elif not fcm_token and phone:
        result = await send_sms_alert(
            phone, f"CrisisRoute Mission: {translated_briefing[:300]}"
        )

    db.collection("alert_logs").add({
        "volunteer_id": volunteer_id,
        "mission_id": mission_id,
        "channel": result.get("channel", "none"),
        "status": result.get("status", "failed"),
        "briefing_preview": translated_briefing[:100],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return result
