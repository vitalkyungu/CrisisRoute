"""Reassign a demo volunteer's mission to your Firebase Auth account.

Use this after seed + Deploy Agent so you can see a mission on /volunteer
with your own Google login (no fake Sophie account needed).

Examples:
  # By Firebase UID (from Authentication console)
  GOOGLE_APPLICATION_CREDENTIALS=backend/crisisroute-firebase-adminsdk-fbsvc-f5dab70143.json \\
    python scripts/assign_mission_to_me.py --uid YOUR_FIREBASE_UID

  # By Google email
  GOOGLE_APPLICATION_CREDENTIALS=backend/crisisroute-firebase-adminsdk-fbsvc-f5dab70143.json \\
    python scripts/assign_mission_to_me.py --email you@gmail.com

  # Dr. Ayşe's mission instead of Sophie's
  python scripts/assign_mission_to_me.py --uid YOUR_UID --from demo-vol-000
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone

import firebase_admin
from firebase_admin import auth, credentials, firestore

SOPHIE_ID = "demo-vol-001"
AYSE_ID = "demo-vol-000"

DEMO_PROFILES = {
    SOPHIE_ID: {
        "display_name": "Sophie Martin",
        "skills": ["medical", "counseling"],
        "languages": ["fr", "en", "tr"],
        "preferred_language": "fr",
        "latitude": 41.050,
        "longitude": 28.990,
    },
    AYSE_ID: {
        "display_name": "Dr. Ayşe Demir",
        "skills": ["medical", "first_aid"],
        "languages": ["tr", "en"],
        "preferred_language": "tr",
        "latitude": 41.015,
        "longitude": 28.950,
    },
}


def init_firebase() -> firestore.Client:
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service-account-key.json")
    if not firebase_admin._apps:
        if os.path.exists(cred_path):
            firebase_admin.initialize_app(credentials.Certificate(cred_path))
        else:
            firebase_admin.initialize_app()
    return firestore.client()


def resolve_uid(db: firestore.Client, uid: str | None, email: str | None) -> tuple[str, str]:
    if uid:
        try:
            user = auth.get_user(uid)
            return user.uid, user.email or ""
        except auth.UserNotFoundError:
            raise SystemExit(f"No Firebase Auth user with UID: {uid}")

    if email:
        try:
            user = auth.get_user_by_email(email)
            return user.uid, user.email or email
        except auth.UserNotFoundError:
            raise SystemExit(f"No Firebase Auth user with email: {email}")

    raise SystemExit("Provide --uid or --email (your Google login from Firebase Authentication).")


def find_mission_for_volunteer(db: firestore.Client, volunteer_id: str) -> firestore.DocumentSnapshot | None:
    active_statuses = {"assigned", "accepted", "en_route", "on_site"}
    missions = db.collection("missions").where("volunteer_id", "==", volunteer_id).stream()
    for doc in missions:
        if doc.to_dict().get("status") in active_statuses:
            return doc
    return None


def find_any_active_mission(db: firestore.Client) -> firestore.DocumentSnapshot | None:
    active_statuses = {"assigned", "accepted", "en_route", "on_site"}
    for doc in db.collection("missions").stream():
        if doc.to_dict().get("status") in active_statuses:
            return doc
    return None


def list_active_missions(db: firestore.Client) -> list[str]:
    active_statuses = {"assigned", "accepted", "en_route", "on_site"}
    lines = []
    for doc in db.collection("missions").stream():
        data = doc.to_dict()
        if data.get("status") in active_statuses:
            vol_id = data.get("volunteer_id", "?")
            lines.append(f"  - {doc.id}: volunteer={vol_id}, status={data.get('status')}")
    return lines


def ensure_volunteer_profile(
    db: firestore.Client,
    uid: str,
    email: str,
    template_id: str,
    *,
    keep_location: bool = False,
) -> tuple[float, float]:
    template = DEMO_PROFILES.get(template_id, DEMO_PROFILES[SOPHIE_ID])
    existing = db.collection("volunteers").document(uid).get()
    existing_data = existing.to_dict() if existing.exists else {}
    display_name = existing_data.get("display_name") or email.split("@")[0]

    if keep_location and existing_data.get("latitude") is not None:
        lat = existing_data["latitude"]
        lng = existing_data["longitude"]
    else:
        lat = template["latitude"]
        lng = template["longitude"]

    profile = {
        "uid": uid,
        "display_name": display_name,
        "email": email,
        "phone": existing_data.get("phone", ""),
        "skills": existing_data.get("skills") or template["skills"],
        "languages": existing_data.get("languages") or template["languages"],
        "preferred_language": existing_data.get("preferred_language") or template["preferred_language"],
        "latitude": lat,
        "longitude": lng,
        "availability": True,
        "status": "assigned",
        "fcm_token": existing_data.get("fcm_token", ""),
    }
    db.collection("volunteers").document(uid).set(profile, merge=True)
    return lat, lng


def ensure_local_incident(
    db: firestore.Client,
    volunteer_lat: float,
    volunteer_lng: float,
    uid: str,
) -> str:
    """Local danger zone at the volunteer for --near-me demos (not Istanbul)."""
    incident_id = f"demo-local-{uid[:8]}"
    db.collection("incidents").document(incident_id).set(
        {
            "title": "Local disaster zone — demo",
            "description": "Simulated danger zone near your position for route avoidance demo.",
            "latitude": volunteer_lat,
            "longitude": volunteer_lng,
            "radius_km": 2,
            "severity": "high",
            "status": "active",
            "source": "demo",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )
    return incident_id


def create_nearby_aid_request(
    db: firestore.Client,
    volunteer_lat: float,
    volunteer_lng: float,
    uid: str,
) -> tuple[str, dict]:
    """Create a one-off aid request ~1.5 km from the volunteer (demo walkthrough)."""
    # ~1.5 km northeast — short route, still outside immediate epicenter
    dest_lat = round(volunteer_lat + 0.012, 4)
    dest_lng = round(volunteer_lng + 0.018, 4)

    req_id = f"demo-near-{uid[:8]}"
    req_data = {
        "title": "Nearby field clinic — urgent medical supplies",
        "description": (
            "Pop-up clinic 1.5 km from your position needs medical kits and a French-speaking "
            "volunteer for triage. Coordinator marked this as high priority for your skills."
        ),
        "latitude": dest_lat,
        "longitude": dest_lng,
        "urgency": "high",
        "category": "medical",
        "skills_needed": ["medical", "first_aid"],
        "languages_needed": ["fr", "en"],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.collection("aid_requests").document(req_id).set(req_data)
    return req_id, req_data


def pick_aid_request(db: firestore.Client) -> tuple[str, dict]:
    """Pick an open aid request, or reopen the next demo request for repeat demos."""
    open_docs = list(db.collection("aid_requests").where("status", "==", "open").stream())
    if open_docs:
        doc = open_docs[0]
        return doc.id, doc.to_dict()

    # Re-open a demo request for repeat walkthroughs (rotate through scenarios)
    for req_id in ("demo-req-000", "demo-req-001", "demo-req-002", "demo-req-003"):
        ref = db.collection("aid_requests").document(req_id)
        snap = ref.get()
        if snap.exists():
            ref.update({"status": "open"})
            return req_id, snap.to_dict()

    raise SystemExit("No aid requests found. Run seed_demo.py first.")


def briefing_for_request(req: dict, template_id: str) -> tuple[str, str]:
    title = req.get("title", "Aid request")
    desc = req.get("description", "")[:200]
    lat = req.get("latitude", 41.008)
    lng = req.get("longitude", 28.978)

    en = f"""MISSION BRIEFING
================
Incident: M7.2 Earthquake — Istanbul, Turkey
Location: {title} ({lat}, {lng})
Need: {desc}
Your role: Report immediately and follow coordinator instructions on site.
ETA: ~12 minutes via safe route
⚠️ Safety: Route avoids the 35km earthquake danger zone. Do not enter red zone."""

    if template_id == SOPHIE_ID:
        fr = f"""BRIEFING DE MISSION
===================
Incident: Séisme M7,2 — Istanbul, Turquie
Lieu: {title} ({lat}, {lng})
Besoin: {desc}
Votre rôle: Rendez-vous immédiatement sur place et suivez les instructions du coordinateur.
ETA: ~12 minutes via itinéraire sécurisé
⚠️ Sécurité: L'itinéraire évite la zone de danger de 35 km. N'entrez pas dans la zone rouge."""
        return en, fr

    return en, en


def create_demo_mission(
    db: firestore.Client,
    uid: str,
    email: str,
    template_id: str = SOPHIE_ID,
    *,
    near_me: bool = False,
) -> tuple[str, str, float, float, float, float]:
    """Create a demo mission directly (when agent hasn't run yet)."""

    active = find_mission_for_volunteer(db, uid)
    if active:
        raise SystemExit(
            f"You already have an active mission ({active.id}, status={active.to_dict().get('status')}). "
            "Complete or cancel it first."
        )

    vol_lat, vol_lng = ensure_volunteer_profile(
        db, uid, email, template_id, keep_location=near_me
    )

    if near_me:
        aid_request_id, req_data = create_nearby_aid_request(db, vol_lat, vol_lng, uid)
        incident_id = ensure_local_incident(db, vol_lat, vol_lng, uid)
    else:
        aid_request_id, req_data = pick_aid_request(db)
        incident_id = "EQ-2026-istanbul-72"

    req_ref = db.collection("aid_requests").document(aid_request_id)

    briefing_en, briefing_local = briefing_for_request(req_data, template_id)
    now = datetime.now(timezone.utc).isoformat()
    vol_doc = db.collection("volunteers").document(uid).get()
    vol_name = (vol_doc.to_dict() or {}).get("display_name", email.split("@")[0])

    mission_data = {
        "volunteer_id": uid,
        "volunteer_name": vol_name,
        "incident_id": incident_id,
        "aid_request_id": aid_request_id,
        "briefing": briefing_en,
        "translated_briefing": briefing_local,
        "route_polyline": "",
        "eta_seconds": 720,
        "distance_meters": 1500 if near_me else 3200,
        "status": "assigned",
        "assigned_at": now,
        "completed_at": "",
    }

    _, doc_ref = db.collection("missions").add(mission_data)
    req_ref.update({"status": "assigned"})
    db.collection("volunteers").document(uid).update({"status": "assigned"})

    dest_lat = req_data.get("latitude", vol_lat)
    dest_lng = req_data.get("longitude", vol_lng)
    return doc_ref.id, req_data.get("title", aid_request_id), vol_lat, vol_lng, dest_lat, dest_lng


def notify_mission_alert(mission_id: str) -> None:
    """POST to local backend to send mission SMS/push (best-effort)."""
    import urllib.error
    import urllib.request

    url = f"http://127.0.0.1:8080/api/alerts/mission/{mission_id}"
    try:
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode()
            print(f"  Alert:     {body}")
    except urllib.error.HTTPError as e:
        print(f"  Alert:     HTTP {e.code} — {e.read().decode()[:200]}")
    except Exception as e:
        print(f"  Alert:     skipped ({e})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Assign a demo mission to your Firebase account.")
    parser.add_argument("--uid", help="Your Firebase Auth UID")
    parser.add_argument("--email", help="Your Google sign-in email")
    parser.add_argument(
        "--from",
        dest="source_id",
        default=SOPHIE_ID,
        help=f"Demo volunteer to take mission from (default: {SOPHIE_ID} = Sophie)",
    )
    parser.add_argument(
        "--any",
        action="store_true",
        help="Use any active mission if the preferred demo volunteer has none",
    )
    parser.add_argument(
        "--create",
        action="store_true",
        help="Create a demo mission directly (skip agent — use when agent fails)",
    )
    parser.add_argument(
        "--near-me",
        action="store_true",
        help="With --create: place destination ~1.5 km from your saved volunteer location",
    )
    args = parser.parse_args()

    db = init_firebase()
    uid, email = resolve_uid(db, args.uid, args.email)

    if args.create:
        mission_id, req_title, vol_lat, vol_lng, dest_lat, dest_lng = create_demo_mission(
            db,
            uid,
            email,
            args.source_id if args.source_id in DEMO_PROFILES else SOPHIE_ID,
            near_me=args.near_me,
        )
        print("=" * 60)
        print("  Demo mission created for you")
        print("=" * 60)
        print(f"  Mission:     {mission_id}")
        print(f"  Assignment:  {req_title}")
        print(f"  Email:       {email}")
        print(f"  UID:         {uid}")
        if args.near_me:
            print(f"  You at:      {vol_lat}, {vol_lng}")
            print(f"  Destination: {dest_lat}, {dest_lng} (~1.5 km away)")
        else:
            print(f"  Briefing:    French (Sophie scenario)")
        print()
        print("  Open: http://localhost:5173/volunteer")
        print("  Sign in with the same Google account and refresh.")
        notify_mission_alert(mission_id)
        return

    mission_doc = find_mission_for_volunteer(db, args.source_id)
    source_id = args.source_id

    if not mission_doc and args.any:
        mission_doc = find_any_active_mission(db)
        if mission_doc:
            source_id = mission_doc.to_dict().get("volunteer_id", args.source_id)

    if not mission_doc:
        active = list_active_missions(db)
        msg = f"No active mission found for {args.source_id}."
        if not active:
            msg += "\n\nNo missions exist yet. Either:"
            msg += "\n  1. Fix agent + run: curl -X POST http://localhost:8080/api/agent/run"
            msg += "\n  2. Create demo mission: python scripts/assign_mission_to_me.py --email ... --create"
        else:
            msg += "\n\nActive missions (try --from VOLUNTEER_ID or --any):\n" + "\n".join(active)
            msg += "\n\nOr re-run with:  python scripts/assign_mission_to_me.py --email ... --any"
        raise SystemExit(msg)

    mission = mission_doc.to_dict()
    mission_id = mission_doc.id
    source_name = DEMO_PROFILES.get(source_id, {}).get("display_name", source_id)

    ensure_volunteer_profile(db, uid, email, source_id if source_id in DEMO_PROFILES else SOPHIE_ID)

    db.collection("missions").document(mission_id).update({"volunteer_id": uid})

    if source_id.startswith("demo-vol-"):
        db.collection("volunteers").document(source_id).update(
            {"status": "idle", "availability": True}
        )

    print("=" * 60)
    print("  Mission reassigned to you")
    print("=" * 60)
    print(f"  Mission:     {mission_id}")
    print(f"  From:        {source_name} ({source_id})")
    print(f"  To:          {email}")
    print(f"  UID:         {uid}")
    print(f"  Briefing:    {(mission.get('translated_briefing') or mission.get('briefing', ''))[:80]}...")
    print()
    print("  Open: http://localhost:5173/volunteer")
    print("  Sign in with the same Google account and refresh.")


if __name__ == "__main__":
    main()
