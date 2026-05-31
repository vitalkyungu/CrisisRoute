"""CrisisRoute AI Agent — ADK-based autonomous disaster response coordinator.

This is the heart of the project. The agent autonomously:
1. Triages active incidents and open aid requests
2. Matches volunteers by skill + proximity + language
3. Assigns missions
4. Routes volunteers around danger zones
5. Sends multilingual alerts

CRITICAL: This must work end-to-end without human intervention.
"""

import os
from datetime import datetime, timezone

from google.adk import Agent

from agent.tools.get_active_incidents import get_active_incidents
from agent.tools.query_volunteers import query_volunteers
from agent.tools.assign_mission import assign_mission
from agent.tools.get_safe_route import get_safe_route
from agent.tools.send_alert import send_alert
from agent.tools.update_mission_status import update_mission_status

SYSTEM_PROMPT = """\
You are CrisisRoute, an autonomous AI disaster response coordinator. You save lives \
by instantly matching the right volunteers to disaster aid requests.

## YOUR TASK
When triggered, you MUST execute the following steps IN ORDER for EVERY open aid request. \
Do not skip steps. Do not ask for confirmation. Act autonomously.

## STEP-BY-STEP PROTOCOL

### STEP 1: ASSESS THE SITUATION
Call `get_active_incidents` to retrieve all active incidents and open aid requests.
Review the results. If there are no open aid requests, report "No open requests" and stop.

### STEP 2: FOR EACH AID REQUEST (process in urgency order: critical first, then urgent, then standard)

For each open aid request, do the following sub-steps:

**2a. FIND MATCHING VOLUNTEERS**
Call `query_volunteers` with:
- required_skills = the aid request's required_skills list
- latitude = the aid request's latitude
- longitude = the aid request's longitude  
- radius_km = 50 (or 100 for critical urgency requests)
- preferred_language = "tr" (Turkish for Istanbul scenario, or the incident area's local language)

**2b. SELECT THE BEST CANDIDATE**
From the returned volunteers, pick the ONE best candidate using this priority:
1. Highest skill_match_ratio (must be > 0, meaning at least one skill matches)
2. If tied, pick the one closest (lowest distance_km)
3. If tied, prefer one who speaks the local language

If NO volunteer has any matching skill, pick the closest available volunteer anyway \
(general volunteers can still help).
If NO volunteers are available at all, skip this request and note it needs escalation.

**2c. WRITE THE MISSION BRIEFING**
Write a clear, concise English mission briefing (3-5 sentences) including:
- WHAT happened (incident type and severity)
- WHAT is needed (the aid request title and description)
- WHERE to go (coordinates or area name from the aid request)
- SAFETY WARNING about the danger zone

**2d. ASSIGN THE MISSION**
Call `assign_mission` with:
- volunteer_id = the selected volunteer's id
- incident_id = the incident that the aid request belongs to
- aid_request_id = the aid request's id
- briefing = your English briefing text

**2e. CALCULATE SAFE ROUTE**
Call `get_safe_route` with:
- volunteer_id = the assigned volunteer's id
- destination_lat = the aid request's latitude
- destination_lng = the aid request's longitude
- incident_id = the incident id (so the route avoids the danger zone)

**2f. SEND MULTILINGUAL ALERT**
Call `send_alert` with:
- volunteer_id = the assigned volunteer's id
- mission_id = the mission_id returned from assign_mission
- briefing = your English briefing text
- target_language = the volunteer's preferred_language field

### STEP 3: REPORT SUMMARY
After processing all requests, provide a summary:
- How many aid requests were processed
- How many volunteers were dispatched
- Any requests that could not be fulfilled (and why)
- Total estimated response time across all missions

## CRITICAL RULES
- NEVER assign a volunteer whose status is not "idle"
- NEVER assign the same volunteer to two different requests in one loop
- Process CRITICAL urgency requests FIRST — lives depend on it
- If assign_mission returns an error, try the NEXT best volunteer
- Always call send_alert AFTER assign_mission succeeds — volunteers need their briefings
- The briefing MUST be in English — the send_alert tool handles translation automatically
"""

# Default to flash-lite — separate free-tier quota from gemini-2.0-flash
AGENT_MODEL = os.getenv("AGENT_MODEL", "gemini-2.0-flash-lite")
FORCE_DETERMINISTIC = os.getenv("AGENT_USE_DETERMINISTIC", "").lower() in ("1", "true", "yes")


def _build_briefing(req: dict, incident: dict | None) -> str:
    title = req.get("title", "Aid request")
    desc = req.get("description", "")[:200]
    lat = req.get("latitude", 41.008)
    lng = req.get("longitude", 28.978)
    inc_title = incident.get("title", "Active disaster") if incident else "Active disaster"
    return (
        f"MISSION BRIEFING\n"
        f"================\n"
        f"Incident: {inc_title}\n"
        f"Location: {title} ({lat}, {lng})\n"
        f"Need: {desc}\n"
        f"Your role: Report immediately and follow coordinator instructions on site.\n"
        f"⚠️ Safety: Route avoids the danger zone. Do not enter red zone."
    )


async def run_agent_loop_deterministic() -> dict:
    """Run the dispatch protocol directly via tools (no Gemini calls).

    Used when API quota is exhausted or AGENT_USE_DETERMINISTIC=1.
    Same steps as the ADK agent: triage → match → assign → route → alert.
    """
    from src.services.firebase import get_db

    situation = get_active_incidents()
    requests = situation.get("aid_requests", [])
    incidents = {i["id"]: i for i in situation.get("incidents", [])}
    default_incident_id = (
        situation["incidents"][0]["id"] if situation.get("incidents") else "EQ-2026-istanbul-72"
    )

    assigned_volunteers: set[str] = set()
    missions_created: list[dict] = []
    skipped: list[str] = []
    tools_invoked: list[str] = ["get_active_incidents"]

    for req in requests:
        req_id = req["id"]
        lat = req.get("latitude", 41.008)
        lng = req.get("longitude", 28.978)
        skills = req.get("required_skills", [])
        radius = 100.0 if req.get("urgency") == "critical" else 50.0
        inc_id = req.get("incident_id") or default_incident_id
        incident = incidents.get(inc_id)

        tools_invoked.append("query_volunteers")
        match_result = query_volunteers(
            required_skills=skills,
            latitude=lat,
            longitude=lng,
            radius_km=radius,
            preferred_language="tr",
        )
        candidates = [
            v for v in match_result.get("volunteers", [])
            if v["id"] not in assigned_volunteers
        ]

        assigned = False
        briefing = _build_briefing(req, incident)

        for volunteer in candidates:
            tools_invoked.append("assign_mission")
            assign_result = assign_mission(
                volunteer_id=volunteer["id"],
                incident_id=inc_id,
                aid_request_id=req_id,
                briefing=briefing,
            )
            if assign_result.get("error"):
                continue

            mission_id = assign_result["mission_id"]
            assigned_volunteers.add(volunteer["id"])

            tools_invoked.append("get_safe_route")
            get_safe_route(
                volunteer_id=volunteer["id"],
                destination_lat=lat,
                destination_lng=lng,
                incident_id=inc_id,
            )

            tools_invoked.append("send_alert")
            send_alert(
                volunteer_id=volunteer["id"],
                mission_id=mission_id,
                briefing=briefing,
                target_language=volunteer.get("preferred_language", "en"),
            )

            missions_created.append({
                "mission_id": mission_id,
                "volunteer": volunteer.get("display_name"),
                "request": req.get("title", req_id),
            })
            assigned = True
            break

        if not assigned:
            skipped.append(req.get("title", req_id))

    summary_parts = [
        f"Deterministic dispatch: {len(missions_created)} mission(s) assigned.",
    ]
    if skipped:
        summary_parts.append(f"Skipped {len(skipped)} request(s) — no available volunteers.")
    summary = " ".join(summary_parts)

    db = get_db()
    db.collection("agent_logs").add({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "trigger": "deterministic_loop",
        "result_summary": summary,
        "missions_created": missions_created,
        "skipped": skipped,
        "tools_invoked": tools_invoked[:50],
        "tool_call_count": len(tools_invoked),
    })

    return {
        "summary": summary,
        "mode": "deterministic",
        "missions_assigned": len(missions_created),
        "missions": missions_created,
        "skipped": skipped,
        "tools_invoked": len(tools_invoked),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


crisisroute_agent = Agent(
    model=AGENT_MODEL,
    name="CrisisRoute",
    description=(
        "Autonomous disaster response coordinator. When triggered, it processes all "
        "open aid requests: finds matching volunteers, assigns missions, calculates "
        "safe routes, and sends multilingual alerts — all without human intervention."
    ),
    instruction=SYSTEM_PROMPT,
    tools=[
        get_active_incidents,
        query_volunteers,
        assign_mission,
        get_safe_route,
        send_alert,
        update_mission_status,
    ],
)


async def run_agent_loop() -> dict:
    """Execute the full autonomous agent loop.
    
    This is the primary entry point called by:
    - Cloud Scheduler (periodic check)
    - Coordinator "Run Agent" button
    - POST /api/agent/run endpoint
    
    The agent will process ALL open aid requests in one pass.
    Falls back to deterministic tool dispatch if Gemini quota is exhausted.
    """
    if FORCE_DETERMINISTIC:
        return await run_agent_loop_deterministic()

    from google.adk.runners import InMemoryRunner
    from google.genai import types

    runner = InMemoryRunner(agent=crisisroute_agent, app_name="crisisroute")
    session = await runner.session_service.create_session(
        app_name="crisisroute", user_id="system"
    )

    trigger_message = types.Content(
        role="user",
        parts=[types.Part.from_text(
            text=(
                "Execute the full disaster response protocol now. "
                "Process all open aid requests: triage, match volunteers, assign missions, "
                "route them safely, and send alerts in their language. "
                "Do not ask for confirmation — act immediately and report results."
            )
        )],
    )

    result_text = ""
    tool_calls_made = []

    try:
        async for event in runner.run_async(
            user_id="system", session_id=session.id, new_message=trigger_message
        ):
            if event.is_final_response() and event.content:
                result_text = event.content.parts[0].text
            elif hasattr(event, "tool_calls") and event.tool_calls:
                for tc in event.tool_calls:
                    tool_calls_made.append(tc.name if hasattr(tc, "name") else str(tc))
    except Exception as exc:
        err = str(exc).lower()
        if "429" in err or "resource_exhausted" in err or "quota" in err:
            fallback = await run_agent_loop_deterministic()
            fallback["gemini_fallback_reason"] = (
                "Gemini API quota exceeded — ran deterministic dispatch instead. "
                "Set AGENT_MODEL=gemini-2.0-flash-lite or enable billing for full ADK loop."
            )
            return fallback
        raise

    from src.services.firebase import get_db

    db = get_db()
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "trigger": "autonomous_loop",
        "model": AGENT_MODEL,
        "result_summary": result_text[:500] if result_text else "No response generated",
        "full_result": result_text,
        "tools_invoked": tool_calls_made[:50],
        "tool_call_count": len(tool_calls_made),
    }
    db.collection("agent_logs").add(log_entry)

    return {
        "summary": result_text[:500] if result_text else "Agent completed with no text response",
        "mode": "adk",
        "model": AGENT_MODEL,
        "tools_invoked": len(tool_calls_made),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def run_reassignment(mission_id: str, reason: str = "volunteer_declined") -> dict:
    """Re-assignment loop triggered when a volunteer declines a mission.
    
    Cancels the current mission and finds the next-best volunteer.
    """
    from google.adk.runners import InMemoryRunner
    from google.genai import types

    runner = InMemoryRunner(agent=crisisroute_agent, app_name="crisisroute")
    session = await runner.session_service.create_session(
        app_name="crisisroute", user_id="system"
    )

    message = types.Content(
        role="user",
        parts=[types.Part.from_text(
            text=(
                f"Mission {mission_id} needs re-assignment because: {reason}. "
                f"First call update_mission_status to cancel mission {mission_id} with reason '{reason}'. "
                f"Then find the aid request from that mission, query for the next best available volunteer, "
                f"and assign a new mission. Route them and send the alert."
            )
        )],
    )

    result_text = ""
    async for event in runner.run_async(
        user_id="system", session_id=session.id, new_message=message
    ):
        if event.is_final_response() and event.content:
            result_text = event.content.parts[0].text

    return {"summary": result_text[:300], "trigger": "reassignment", "original_mission": mission_id}
