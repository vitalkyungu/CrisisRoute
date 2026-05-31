from fastapi import APIRouter, HTTPException

from src.models.incident import Incident
from src.services.firebase import get_db
from src.services.disaster_feed import ingest_incidents

router = APIRouter()


@router.get("/")
async def list_incidents(status: str = "active"):
    db = get_db()
    docs = db.collection("incidents").where("status", "==", status).stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/{incident_id}")
async def get_incident(incident_id: str):
    db = get_db()
    doc = db.collection("incidents").document(incident_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"id": doc.id, **doc.to_dict()}


@router.post("/poll")
async def trigger_feed_poll(replace_mock: bool = True, generate_aid: bool = True):
    """Poll GDACS RSS for live global disasters and sync to Firestore."""
    result = await ingest_incidents(
        replace_mock=replace_mock,
        generate_aid_requests=generate_aid,
    )
    return result


@router.post("/")
async def create_incident(incident: Incident):
    db = get_db()
    doc_ref = db.collection("incidents").add(incident.model_dump())
    return {"id": doc_ref[1].id, "status": "created"}
