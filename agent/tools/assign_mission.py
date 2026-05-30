"""ADK Tool: Create a mission assignment linking a volunteer to an aid request.

This is the decisive action — once called, a volunteer is committed to a mission.
Includes safety checks to prevent double-assignment.
"""

from datetime import datetime, timezone


def assign_mission(
    volunteer_id: str,
    incident_id: str,
    aid_request_id: str,
    briefing: str,
) -> dict:
    """Assign a volunteer to a mission for a specific aid request.
    
    IMPORTANT: This tool has side effects:
    - Creates a new mission document
    - Updates volunteer status to "assigned" (they become unavailable)
    - Updates aid request status to "assigned" (it's no longer open)
    
    If this returns an error, you MUST try the next-best volunteer.
    
    Args:
        volunteer_id: The Firestore document ID of the volunteer to assign
        incident_id: The parent incident this mission relates to
        aid_request_id: The specific aid request being fulfilled
        briefing: English mission briefing text you generated
    
    Returns mission_id on success, or error message if assignment failed.
    """
    from src.services.firebase import get_db

    db = get_db()

    # --- Safety check: volunteer exists and is idle ---
    vol_ref = db.collection("volunteers").document(volunteer_id)
    vol_doc = vol_ref.get()
    if not vol_doc.exists:
        return {"error": f"Volunteer {volunteer_id} not found. Try another volunteer."}

    vol_data = vol_doc.to_dict()
    if vol_data.get("status") != "idle":
        return {
            "error": f"Volunteer {vol_data.get('display_name', volunteer_id)} is currently "
            f"'{vol_data.get('status')}', not idle. Pick another volunteer.",
        }
    if not vol_data.get("availability", False):
        return {
            "error": f"Volunteer {vol_data.get('display_name', volunteer_id)} has availability=False. "
            f"Pick another volunteer.",
        }

    # --- Safety check: aid request is still open ---
    req_ref = db.collection("aid_requests").document(aid_request_id)
    req_doc = req_ref.get()
    if req_doc.exists and req_doc.to_dict().get("status") != "open":
        return {
            "error": f"Aid request {aid_request_id} is no longer open (status: "
            f"{req_doc.to_dict().get('status')}). Skip this request.",
        }

    # --- Create mission ---
    now = datetime.now(timezone.utc).isoformat()
    mission_data = {
        "volunteer_id": volunteer_id,
        "volunteer_name": vol_data.get("display_name", ""),
        "incident_id": incident_id,
        "aid_request_id": aid_request_id,
        "briefing": briefing,
        "translated_briefing": "",
        "route_polyline": "",
        "eta_seconds": 0,
        "distance_meters": 0,
        "status": "assigned",
        "assigned_at": now,
        "completed_at": "",
    }

    _, doc_ref = db.collection("missions").add(mission_data)

    # --- Update volunteer status atomically ---
    vol_ref.update({"status": "assigned"})

    # --- Update aid request status ---
    if req_doc.exists:
        req_ref.update({"status": "assigned"})

    # --- Log the decision ---
    db.collection("agent_logs").add({
        "timestamp": now,
        "action": "mission_assigned",
        "mission_id": doc_ref.id,
        "volunteer_id": volunteer_id,
        "volunteer_name": vol_data.get("display_name", ""),
        "aid_request_id": aid_request_id,
        "incident_id": incident_id,
        "briefing_preview": briefing[:100],
    })

    return {
        "mission_id": doc_ref.id,
        "status": "assigned",
        "volunteer_id": volunteer_id,
        "volunteer_name": vol_data.get("display_name", ""),
        "message": (
            f"SUCCESS: {vol_data.get('display_name', 'Volunteer')} assigned to mission {doc_ref.id}. "
            f"Now call get_safe_route and then send_alert for this volunteer."
        ),
    }
