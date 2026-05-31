"""Daily Good Deeds Board — community micro-missions with points and streaks."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from src.services.alerts import send_push_notification
from src.services.firebase import get_db
from src.services.maps import haversine_km

POINTS_DEED = 10


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _volunteer_name(volunteer_id: str) -> str:
    doc = get_db().collection("volunteers").document(volunteer_id).get()
    if doc.exists:
        return doc.to_dict().get("display_name") or "A volunteer"
    return "A volunteer"


async def _notify_poster(
    posted_by: str,
    title: str,
    body: str,
    deed_id: str,
    event: str,
) -> None:
    if not posted_by:
        return
    doc = get_db().collection("volunteers").document(posted_by).get()
    if not doc.exists:
        return
    token = (doc.to_dict().get("fcm_token") or "").strip()
    if not token:
        return
    try:
        await send_push_notification(
            fcm_token=token,
            title=title,
            body=body,
            data={"type": event, "deed_id": deed_id},
        )
    except Exception:
        pass


async def _moderate_deed(description: str, category: str) -> tuple[bool, str]:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return True, "ok"
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(os.getenv("AGENT_MODEL", "gemini-2.0-flash-lite"))
        prompt = (
            "Is this community good-deed request safe and appropriate? "
            f"Category: {category}. Description: {description}. "
            "Reply APPROVE or REJECT then one short reason."
        )
        text = (model.generate_content(prompt).text or "").strip().upper()
        if text.startswith("REJECT"):
            return False, text
        return True, "approved"
    except Exception:
        return True, "auto-approved"


def _bump_stats(user_id: str, *, deed: bool = False, points: int = 0) -> dict:
    db = get_db()
    ref = db.collection("volunteer_stats").document(user_id)
    doc = ref.get()
    today = _today_utc()
    data = doc.to_dict() if doc.exists else {}
    last_active = data.get("last_active_date", "")
    streak = data.get("current_streak", 0)

    if last_active != today:
        if last_active:
            try:
                last_dt = datetime.strptime(last_active, "%Y-%m-%d").date()
                today_dt = datetime.strptime(today, "%Y-%m-%d").date()
                streak = streak + 1 if (today_dt - last_dt).days == 1 else 1
            except ValueError:
                streak = 1
        else:
            streak = 1

    update = {
        "user_id": user_id,
        "total_points": data.get("total_points", 0) + points,
        "current_streak": streak,
        "longest_streak": max(data.get("longest_streak", 0), streak),
        "deeds_completed": data.get("deeds_completed", 0) + (1 if deed else 0),
        "last_active_date": today,
    }
    ref.set(update, merge=True)
    return update


async def post_deed(
    posted_by: str,
    description: str,
    latitude: float,
    longitude: float,
    category: str = "errand",
    time_window: str = "",
) -> dict:
    approved, reason = await _moderate_deed(description, category)
    if not approved:
        return {"error": f"Deed not approved: {reason}", "status": "rejected"}

    db = get_db()
    deed = {
        "posted_by": posted_by,
        "description": description,
        "latitude": latitude,
        "longitude": longitude,
        "category": category,
        "time_window": time_window,
        "status": "open",
        "claimed_by": "",
        "claimed_by_name": "",
        "completed_at": "",
        "created_at": _now_iso(),
    }
    _, ref = db.collection("good_deeds").add(deed)
    return {"id": ref.id, "status": "open", **deed}


def list_nearby_open_deeds(
    latitude: float,
    longitude: float,
    radius_km: float = 15.0,
    exclude_user_id: str = "",
) -> list[dict]:
    db = get_db()
    results = []
    for doc in db.collection("good_deeds").where("status", "==", "open").stream():
        d = doc.to_dict()
        if exclude_user_id and d.get("posted_by") == exclude_user_id:
            continue
        dist = haversine_km(latitude, longitude, d["latitude"], d["longitude"])
        if dist <= radius_km:
            results.append({"id": doc.id, **d, "distance_km": round(dist, 2)})
    return sorted(results, key=lambda x: x["distance_km"])


def list_helping_deeds(volunteer_id: str) -> list[dict]:
    db = get_db()
    results = []
    for doc in db.collection("good_deeds").where("claimed_by", "==", volunteer_id).stream():
        d = doc.to_dict()
        if d.get("status") == "claimed":
            results.append({"id": doc.id, **d})
    return sorted(results, key=lambda x: x.get("created_at", ""), reverse=True)


def list_my_posted_deeds(user_id: str) -> list[dict]:
    db = get_db()
    results = []
    for doc in db.collection("good_deeds").where("posted_by", "==", user_id).stream():
        d = doc.to_dict()
        if d.get("status") in ("open", "claimed"):
            results.append({"id": doc.id, **d})
    return sorted(results, key=lambda x: x.get("created_at", ""), reverse=True)


async def claim_deed(deed_id: str, volunteer_id: str) -> dict:
    db = get_db()
    ref = db.collection("good_deeds").document(deed_id)
    doc = ref.get()
    if not doc.exists:
        return {"error": "Deed not found"}
    d = doc.to_dict()
    if d.get("status") != "open":
        return {"error": "Already claimed"}
    if d.get("posted_by") == volunteer_id:
        return {"error": "You cannot claim your own deed"}

    helper_name = _volunteer_name(volunteer_id)
    ref.update({
        "status": "claimed",
        "claimed_by": volunteer_id,
        "claimed_by_name": helper_name,
        "claimed_at": _now_iso(),
    })

    posted_by = d.get("posted_by", "")
    snippet = (d.get("description") or "your request")[:80]
    await _notify_poster(
        posted_by,
        title="Someone is helping you!",
        body=f"{helper_name} claimed your good deed: {snippet}",
        deed_id=deed_id,
        event="good_deed_claimed",
    )

    return {
        "id": deed_id,
        "status": "claimed",
        "claimed_by_name": helper_name,
        "poster_notified": bool(posted_by),
    }


async def complete_deed(deed_id: str, volunteer_id: str) -> dict:
    db = get_db()
    ref = db.collection("good_deeds").document(deed_id)
    doc = ref.get()
    if not doc.exists:
        return {"error": "Deed not found"}
    d = doc.to_dict()
    if d.get("claimed_by") != volunteer_id:
        return {"error": "Not your deed"}
    if d.get("status") != "claimed":
        return {"error": "Deed is not in claimed state"}

    now = _now_iso()
    ref.update({"status": "completed", "completed_at": now})
    stats = bump_volunteer_stats(volunteer_id, deed=True, points=POINTS_DEED)

    helper_name = d.get("claimed_by_name") or _volunteer_name(volunteer_id)
    posted_by = d.get("posted_by", "")
    snippet = (d.get("description") or "your request")[:80]
    await _notify_poster(
        posted_by,
        title="Good deed completed!",
        body=f"{helper_name} finished helping: {snippet}",
        deed_id=deed_id,
        event="good_deed_completed",
    )

    return {
        "id": deed_id,
        "status": "completed",
        "points_earned": POINTS_DEED,
        "stats": stats,
        "poster_notified": bool(posted_by),
    }


def bump_volunteer_stats(user_id: str, *, deed: bool = False, points: int = 0) -> dict:
    """Public helper — used by good deeds and civic completions."""
    return _bump_stats(user_id, deed=deed, points=points)


def get_volunteer_stats(user_id: str) -> dict:
    db = get_db()
    doc = db.collection("volunteer_stats").document(user_id).get()
    if not doc.exists:
        return {
            "user_id": user_id,
            "total_points": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "deeds_completed": 0,
            "missions_completed": 0,
        }
    return {"id": doc.id, **doc.to_dict()}
