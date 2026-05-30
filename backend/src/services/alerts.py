"""Alert delivery — FCM push notifications and Twilio SMS fallback."""

import os

from firebase_admin import messaging

from src.services.firebase import get_db


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
    return {"message_id": response, "channel": "fcm"}


async def send_sms_alert(phone: str, body: str) -> dict:
    """Send SMS via Twilio as fallback for volunteers without the app."""
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
        return {"message_sid": message.sid, "channel": "sms"}
    except Exception as e:
        return {"error": str(e), "channel": "sms"}


async def send_mission_alert(
    volunteer_id: str, mission_id: str, briefing: str, translated_briefing: str
) -> dict:
    """Send mission briefing to volunteer via best available channel."""
    db = get_db()
    vol_doc = db.collection("volunteers").document(volunteer_id).get()

    if not vol_doc.exists:
        return {"error": "Volunteer not found"}

    volunteer = vol_doc.to_dict()
    result = {}

    if volunteer.get("fcm_token"):
        result = await send_push_notification(
            fcm_token=volunteer["fcm_token"],
            title="🚨 New Mission Assignment",
            body=translated_briefing[:200],
            data={"mission_id": mission_id, "type": "mission_assignment"},
        )
    elif volunteer.get("phone"):
        result = await send_sms_alert(
            phone=volunteer["phone"],
            body=f"CrisisRoute Mission: {translated_briefing[:160]}",
        )
    else:
        result = {"error": "No contact method available"}

    db.collection("alert_logs").add({
        "volunteer_id": volunteer_id,
        "mission_id": mission_id,
        "channel": result.get("channel", "none"),
        "status": "sent" if "error" not in result else "failed",
        "briefing_preview": translated_briefing[:100],
    })

    return result
