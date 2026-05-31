from fastapi import APIRouter, HTTPException

from src.services.alerts import send_mission_alert, send_sms_alert, send_welcome_sms
from src.services.firebase import get_db

router = APIRouter()


@router.get("/logs")
async def get_alert_logs(mission_id: str | None = None):
    db = get_db()
    query = db.collection("alert_logs")
    if mission_id:
        query = query.where("mission_id", "==", mission_id)
    docs = query.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/stats")
async def get_alert_stats():
    db = get_db()
    logs = list(db.collection("alert_logs").stream())
    total = len(logs)
    sent = sum(1 for log in logs if log.to_dict().get("status") == "sent")
    failed = total - sent
    return {"total": total, "sent": sent, "failed": failed}


@router.post("/welcome/{volunteer_id}")
async def welcome_sms(volunteer_id: str):
    """Send a welcome SMS after profile setup (Twilio)."""
    result = await send_welcome_sms(volunteer_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/mission/{mission_id}")
async def mission_alert(mission_id: str):
    """Send mission briefing via FCM and/or SMS."""
    db = get_db()
    doc = db.collection("missions").document(mission_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Mission not found")
    mission = doc.to_dict()
    volunteer_id = mission.get("volunteer_id")
    if not volunteer_id:
        raise HTTPException(status_code=400, detail="Mission has no volunteer")
    result = await send_mission_alert(
        volunteer_id=volunteer_id,
        mission_id=mission_id,
        briefing=mission.get("briefing") or "",
        translated_briefing=mission.get("translated_briefing") or mission.get("briefing") or "",
    )
    if result.get("error") and result.get("status") not in ("sent", "skipped"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result
