"""Mission management endpoints.

Handles the full mission lifecycle:
assigned → accepted → en_route → on_site → completed
                                             ↓
                                          cancelled → triggers re-assignment
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, BackgroundTasks

from src.models.mission import AidRequest, Mission
from src.services.firebase import get_db

router = APIRouter()


@router.get("/")
async def list_missions(status: str | None = None):
    db = get_db()
    query = db.collection("missions")
    if status:
        query = query.where("status", "==", status)
    docs = query.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/{mission_id}")
async def get_mission(mission_id: str):
    db = get_db()
    doc = db.collection("missions").document(mission_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Mission not found")
    return {"id": doc.id, **doc.to_dict()}


@router.post("/{mission_id}/route")
async def calculate_route(mission_id: str):
    """Calculate and save a safe route that avoids the incident danger zone."""
    from src.services.routing import calculate_mission_route

    result = calculate_mission_route(mission_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return {"status": "route_calculated", **result}


@router.put("/{mission_id}/status")
async def update_mission_status(
    mission_id: str, status: str, background_tasks: BackgroundTasks
):
    """Update mission status — triggers side effects for terminal states."""
    valid_statuses = ["accepted", "en_route", "on_site", "completed", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}",
        )

    db = get_db()
    doc_ref = db.collection("missions").document(mission_id)
    mission_doc = doc_ref.get()
    if not mission_doc.exists:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission = mission_doc.to_dict()
    update_data = {"status": status}

    if status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    doc_ref.update(update_data)

    if status == "accepted" and not mission.get("route_polyline"):
        background_tasks.add_task(_calculate_route, mission_id)

    # Free the volunteer if mission is terminal
    if status in ("completed", "cancelled"):
        db.collection("volunteers").document(mission["volunteer_id"]).update(
            {"status": "idle", "availability": True}
        )

    # If cancelled (volunteer declined), re-open the aid request and trigger re-assignment
    if status == "cancelled" and mission.get("aid_request_id"):
        db.collection("aid_requests").document(mission["aid_request_id"]).update(
            {"status": "open"}
        )
        # Trigger agent re-assignment in background (non-blocking)
        background_tasks.add_task(_trigger_reassignment, mission_id)

    return {
        "status": "updated",
        "new_status": status,
        "mission_id": mission_id,
        "volunteer_freed": status in ("completed", "cancelled"),
    }


async def _calculate_route(mission_id: str):
    """Background task: compute safe route after volunteer accepts."""
    try:
        from src.services.routing import calculate_mission_route
        calculate_mission_route(mission_id)
    except Exception:
        pass


async def _trigger_reassignment(mission_id: str):
    """Background task: trigger agent to reassign the cancelled mission."""
    try:
        from agent.src.crisisroute_agent import run_reassignment
        await run_reassignment(mission_id, reason="volunteer_declined")
    except Exception:
        pass  # Silently fail — coordinator can manually trigger


@router.post("/aid-request")
async def create_aid_request(request: AidRequest):
    db = get_db()
    _, doc_ref = db.collection("aid_requests").add(request.model_dump())
    return {"id": doc_ref.id, "status": "created"}


@router.get("/aid-requests/open")
async def list_open_aid_requests():
    db = get_db()
    docs = db.collection("aid_requests").where("status", "==", "open").stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]
