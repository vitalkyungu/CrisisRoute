"""Agent trigger endpoints — the heart of the system.

POST /api/agent/run — triggers the full autonomous triage→match→assign→route→notify loop.
POST /api/agent/reassign — triggers re-assignment when a volunteer declines.
GET /api/agent/logs — retrieve agent decision history for coordinator dashboard.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/run")
async def trigger_agent():
    """Trigger the full autonomous AI agent loop.
    
    The agent will:
    1. Get all active incidents and open aid requests
    2. For each request (critical first): find matching volunteers
    3. Assign the best volunteer to each request
    4. Calculate safe routes avoiding danger zones
    5. Translate briefings and send multilingual alerts
    
    This is THE critical endpoint. Everything else is plumbing.
    """
    from src.services.firebase import get_db

    db = get_db()

    # Quick sanity check — is there work to do?
    open_requests = list(
        db.collection("aid_requests").where("status", "==", "open").stream()
    )
    active_incidents = list(
        db.collection("incidents").where("status", "==", "active").stream()
    )

    if not open_requests and not active_incidents:
        return {
            "status": "no_action",
            "reason": "No open aid requests or active incidents",
            "open_requests": 0,
            "active_incidents": 0,
        }

    try:
        from agent.src.crisisroute_agent import run_agent_loop

        result = await run_agent_loop()
        return {
            "status": "completed",
            "open_requests_processed": len(open_requests),
            "active_incidents": len(active_incidents),
            **result,
        }
    except ImportError as e:
        return {
            "status": "error",
            "reason": f"Agent module not available: {e}",
            "hint": "Ensure agent/ directory is in Python path",
        }
    except Exception as e:
        return {
            "status": "error",
            "reason": str(e),
        }


@router.post("/reassign/{mission_id}")
async def trigger_reassignment(mission_id: str, reason: str = "volunteer_declined"):
    """Trigger re-assignment for a specific mission.
    
    Called when a volunteer declines (taps "Decline" button).
    The agent will cancel the current mission and find the next-best volunteer.
    """
    from src.services.firebase import get_db

    db = get_db()

    mission_doc = db.collection("missions").document(mission_id).get()
    if not mission_doc.exists:
        raise HTTPException(status_code=404, detail="Mission not found")

    try:
        from agent.src.crisisroute_agent import run_reassignment

        result = await run_reassignment(mission_id, reason)
        return {"status": "reassignment_triggered", **result}
    except ImportError:
        # Fallback: just cancel and mark request as open for next agent run
        mission = mission_doc.to_dict()
        db.collection("missions").document(mission_id).update({"status": "cancelled"})
        db.collection("volunteers").document(mission["volunteer_id"]).update(
            {"status": "idle", "availability": True}
        )
        if mission.get("aid_request_id"):
            db.collection("aid_requests").document(mission["aid_request_id"]).update(
                {"status": "open"}
            )
        return {
            "status": "cancelled_and_reopened",
            "note": "Agent not available — mission cancelled, request reopened for next run",
        }


@router.get("/logs")
async def get_agent_logs(limit: int = 50):
    """Retrieve agent decision logs for the coordinator dashboard."""
    from src.services.firebase import get_db

    db = get_db()
    docs = (
        db.collection("agent_logs")
        .order_by("timestamp", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/status")
async def get_agent_status():
    """Quick overview of what the agent has done and what's pending."""
    from src.services.firebase import get_db

    db = get_db()

    open_requests = len(list(
        db.collection("aid_requests").where("status", "==", "open").stream()
    ))
    assigned_missions = len(list(
        db.collection("missions").where("status", "==", "assigned").stream()
    ))
    completed_missions = len(list(
        db.collection("missions").where("status", "==", "completed").stream()
    ))
    available_volunteers = len(list(
        db.collection("volunteers")
        .where("availability", "==", True)
        .where("status", "==", "idle")
        .stream()
    ))

    return {
        "pending_requests": open_requests,
        "assigned_missions": assigned_missions,
        "completed_missions": completed_missions,
        "available_volunteers": available_volunteers,
        "needs_agent_run": open_requests > 0,
    }
