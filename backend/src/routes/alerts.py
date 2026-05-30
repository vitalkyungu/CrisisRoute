from fastapi import APIRouter

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
