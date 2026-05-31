"""Civic report volunteer workflow + AI overseer summary."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from src.services.firebase import get_db
from src.services.good_deeds import bump_volunteer_stats, get_volunteer_stats
from src.services.maps import haversine_km

POINTS_CIVIC = 10


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _volunteer_name(volunteer_id: str) -> str:
    doc = get_db().collection("volunteers").document(volunteer_id).get()
    if doc.exists:
        return doc.to_dict().get("display_name") or "Volunteer"
    return "Volunteer"


def list_nearby_open(
    latitude: float,
    longitude: float,
    radius_km: float = 25.0,
) -> list[dict]:
    db = get_db()
    results = []
    for doc in db.collection("civic_reports").stream():
        d = doc.to_dict() or {}
        if d.get("status") != "open":
            continue
        dist = haversine_km(latitude, longitude, d["latitude"], d["longitude"])
        if dist <= radius_km:
            results.append({"id": doc.id, **d, "distance_km": round(dist, 2)})
    return sorted(results, key=lambda x: x["distance_km"])


def list_checking_out(volunteer_id: str) -> list[dict]:
    db = get_db()
    return [
        {"id": doc.id, **doc.to_dict()}
        for doc in db.collection("civic_reports")
        .where("claimed_by", "==", volunteer_id)
        .stream()
        if (doc.to_dict() or {}).get("status") == "claimed"
    ]


def list_all_active() -> list[dict]:
    db = get_db()
    results = []
    for doc in db.collection("civic_reports").stream():
        d = doc.to_dict() or {}
        if d.get("status") in ("open", "claimed"):
            results.append({"id": doc.id, **d})
    return sorted(results, key=lambda x: x.get("synced_at", ""), reverse=True)


async def check_out_report(report_id: str, volunteer_id: str) -> dict:
    db = get_db()
    ref = db.collection("civic_reports").document(report_id)
    doc = ref.get()
    if not doc.exists:
        return {"error": "Report not found"}
    d = doc.to_dict() or {}
    if d.get("status") != "open":
        return {"error": "Already checked out or resolved"}
    name = _volunteer_name(volunteer_id)
    ref.update({
        "status": "claimed",
        "claimed_by": volunteer_id,
        "claimed_by_name": name,
        "claimed_at": _now_iso(),
    })
    return {"id": report_id, "status": "claimed", "claimed_by_name": name}


async def complete_report(report_id: str, volunteer_id: str) -> dict:
    db = get_db()
    ref = db.collection("civic_reports").document(report_id)
    doc = ref.get()
    if not doc.exists:
        return {"error": "Report not found"}
    d = doc.to_dict() or {}
    if d.get("claimed_by") != volunteer_id:
        return {"error": "Not your checkout"}
    if d.get("status") != "claimed":
        return {"error": "Not in checked-out state"}
    ref.update({"status": "completed", "completed_at": _now_iso()})
    stats = bump_volunteer_stats(volunteer_id, deed=True, points=POINTS_CIVIC)
    return {
        "id": report_id,
        "status": "completed",
        "points_earned": POINTS_CIVIC,
        "stats": stats,
    }


async def generate_overseer_summary() -> dict:
    db = get_db()
    civic_open = 0
    civic_claimed = 0
    civic_completed_today = 0
    civic_samples: list[str] = []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for doc in db.collection("civic_reports").stream():
        d = doc.to_dict() or {}
        st = d.get("status")
        if st == "open":
            civic_open += 1
            if len(civic_samples) < 5:
                civic_samples.append(f"OPEN: {d.get('title')} ({d.get('place', 'local')})")
        elif st == "claimed":
            civic_claimed += 1
            civic_samples.append(
                f"IN PROGRESS: {d.get('title')} — {d.get('claimed_by_name', 'volunteer')}"
            )
        elif st == "completed" and (d.get("completed_at") or "").startswith(today):
            civic_completed_today += 1

    deeds_open = sum(
        1 for doc in db.collection("good_deeds").stream() if (doc.to_dict() or {}).get("status") == "open"
    )
    deeds_claimed = sum(
        1 for doc in db.collection("good_deeds").stream() if (doc.to_dict() or {}).get("status") == "claimed"
    )
    missions_active = sum(
        1
        for doc in db.collection("missions").stream()
        if (doc.to_dict() or {}).get("status") not in ("completed", "cancelled")
    )
    volunteers_idle = sum(
        1
        for doc in db.collection("volunteers").stream()
        if (doc.to_dict() or {}).get("status") == "idle" and (doc.to_dict() or {}).get("availability")
    )

    facts = (
        f"Civic: {civic_open} open, {civic_claimed} volunteers checking out, "
        f"{civic_completed_today} completed today.\n"
        f"Good deeds: {deeds_open} open, {deeds_claimed} claimed.\n"
        f"Disaster missions: {missions_active} active. Volunteers idle: {volunteers_idle}.\n"
        f"Sample civic items:\n" + "\n".join(civic_samples[:8])
    )

    summary = facts
    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(os.getenv("AGENT_MODEL", "gemini-2.0-flash-lite"))
            prompt = (
                "You are the CrisisRoute AI overseer for a command center coordinator. "
                "Write a 4-6 sentence operational briefing from these facts. "
                "Highlight gaps (unclaimed civic issues), active volunteers, and priorities. "
                "Be concise and actionable.\n\n" + facts
            )
            summary = (model.generate_content(prompt).text or facts).strip()
        except Exception:
            pass

    return {
        "summary": summary,
        "stats": {
            "civic_open": civic_open,
            "civic_claimed": civic_claimed,
            "civic_completed_today": civic_completed_today,
            "deeds_open": deeds_open,
            "deeds_claimed": deeds_claimed,
            "missions_active": missions_active,
            "volunteers_idle": volunteers_idle,
        },
    }
