"""ADK Tool: Update mission or volunteer status.

Used by the agent for re-assignment (cancel + reassign) and by
the backend when volunteer taps status buttons.
"""

from datetime import datetime, timezone


def update_mission_status(
    mission_id: str,
    new_status: str,
    reason: str = "",
) -> dict:
    """Update the status of a mission and handle side effects.
    
    Args:
        mission_id: The mission document ID to update
        new_status: One of: accepted, en_route, on_site, completed, cancelled
        reason: Optional reason (especially for cancellations/re-assignments)
    
    Side effects:
    - "completed" or "cancelled" → volunteer set back to "idle" + available
    - "cancelled" → aid request set back to "open" (ready for re-assignment)
    """
    from src.services.firebase import get_db

    db = get_db()
    valid_statuses = ["accepted", "en_route", "on_site", "completed", "cancelled"]
    if new_status not in valid_statuses:
        return {"error": f"Invalid status '{new_status}'. Must be one of: {valid_statuses}"}

    mission_ref = db.collection("missions").document(mission_id)
    mission_doc = mission_ref.get()
    if not mission_doc.exists:
        return {"error": f"Mission {mission_id} not found"}

    mission = mission_doc.to_dict()
    old_status = mission.get("status", "unknown")

    update = {"status": new_status}
    if new_status == "completed":
        update["completed_at"] = datetime.now(timezone.utc).isoformat()

    mission_ref.update(update)

    # Free the volunteer if mission is terminal
    if new_status in ("completed", "cancelled"):
        vol_ref = db.collection("volunteers").document(mission["volunteer_id"])
        vol_ref.update({"status": "idle", "availability": True})

        # Re-open the aid request if cancelled (enables re-assignment)
        if new_status == "cancelled" and mission.get("aid_request_id"):
            req_ref = db.collection("aid_requests").document(mission["aid_request_id"])
            if req_ref.get().exists:
                req_ref.update({"status": "open"})

    # Log the status change
    db.collection("agent_logs").add({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "mission_status_update",
        "mission_id": mission_id,
        "old_status": old_status,
        "new_status": new_status,
        "reason": reason,
        "volunteer_id": mission.get("volunteer_id", ""),
        "volunteer_freed": new_status in ("completed", "cancelled"),
    })

    return {
        "mission_id": mission_id,
        "old_status": old_status,
        "new_status": new_status,
        "volunteer_id": mission.get("volunteer_id", ""),
        "volunteer_freed": new_status in ("completed", "cancelled"),
        "aid_request_reopened": new_status == "cancelled",
        "message": (
            f"Mission {mission_id} updated: {old_status} → {new_status}."
            + (f" Reason: {reason}" if reason else "")
            + (" Volunteer is now free for new assignments." if new_status in ("completed", "cancelled") else "")
        ),
    }
