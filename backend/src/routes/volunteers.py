from fastapi import APIRouter, HTTPException

from src.models.volunteer import Volunteer, VolunteerRegistration
from src.services.firebase import get_db
from src.services.maps import get_volunteers_within_radius

router = APIRouter()


@router.get("/")
async def list_volunteers(available_only: bool = False):
    db = get_db()
    query = db.collection("volunteers")
    if available_only:
        query = query.where("availability", "==", True)
    docs = query.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/{volunteer_id}")
async def get_volunteer(volunteer_id: str):
    db = get_db()
    doc = db.collection("volunteers").document(volunteer_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return {"id": doc.id, **doc.to_dict()}


@router.post("/register")
async def register_volunteer(registration: VolunteerRegistration):
    db = get_db()
    doc_ref = db.collection("volunteers").add(registration.model_dump())
    return {"id": doc_ref[1].id, "status": "registered"}


@router.put("/{volunteer_id}/location")
async def update_location(volunteer_id: str, latitude: float, longitude: float):
    db = get_db()
    doc_ref = db.collection("volunteers").document(volunteer_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    doc_ref.update({"latitude": latitude, "longitude": longitude})
    return {"status": "location_updated"}


@router.put("/{volunteer_id}/availability")
async def toggle_availability(volunteer_id: str, available: bool):
    db = get_db()
    doc_ref = db.collection("volunteers").document(volunteer_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    doc_ref.update({"availability": available})
    return {"status": "availability_updated", "available": available}


@router.get("/nearby/{incident_id}")
async def get_nearby_volunteers(incident_id: str, radius_km: float = 50.0):
    db = get_db()
    incident_doc = db.collection("incidents").document(incident_id).get()
    if not incident_doc.exists:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident = incident_doc.to_dict()
    volunteers = [
        {"id": doc.id, **doc.to_dict()}
        for doc in db.collection("volunteers")
        .where("availability", "==", True)
        .stream()
    ]

    nearby = get_volunteers_within_radius(
        volunteers, incident["latitude"], incident["longitude"], radius_km
    )
    return nearby
