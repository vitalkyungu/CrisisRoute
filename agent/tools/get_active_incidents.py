"""ADK Tool: Retrieve active incidents and open aid requests from Firestore.

This is the first tool called in every agent loop — it gives the agent
situational awareness of what's happening and what needs to be done.
"""


def get_active_incidents() -> dict:
    """Get all active disaster incidents and their open (unassigned) aid requests.
    
    Returns a structured overview of the current situation:
    - Active incidents with location and severity
    - Open aid requests sorted by urgency (critical first)
    
    Use this to understand what needs to be done before matching volunteers.
    """
    from src.services.firebase import get_db

    db = get_db()

    # Get active incidents
    incidents = []
    for doc in db.collection("incidents").where("status", "==", "active").stream():
        incident = doc.to_dict()
        incident["id"] = doc.id
        incidents.append(incident)

    # Get open aid requests (not yet assigned to anyone)
    aid_requests = []
    for doc in db.collection("aid_requests").where("status", "==", "open").stream():
        req = doc.to_dict()
        req["id"] = doc.id
        aid_requests.append(req)

    # Sort by urgency: critical > urgent > standard
    urgency_order = {"critical": 0, "urgent": 1, "standard": 2}
    aid_requests.sort(key=lambda r: urgency_order.get(r.get("urgency", "standard"), 2))

    # Count missions already in progress
    active_missions = list(
        db.collection("missions")
        .where("status", "in", ["assigned", "accepted", "en_route", "on_site"])
        .stream()
    )

    return {
        "incidents": incidents,
        "incident_count": len(incidents),
        "aid_requests": aid_requests,
        "open_request_count": len(aid_requests),
        "active_mission_count": len(active_missions),
        "summary": (
            f"SITUATION REPORT: {len(incidents)} active incident(s), "
            f"{len(aid_requests)} open aid request(s) awaiting assignment, "
            f"{len(active_missions)} mission(s) already in progress."
        ),
        "urgency_breakdown": {
            "critical": sum(1 for r in aid_requests if r.get("urgency") == "critical"),
            "urgent": sum(1 for r in aid_requests if r.get("urgency") == "urgent"),
            "standard": sum(1 for r in aid_requests if r.get("urgency") == "standard"),
        },
    }
