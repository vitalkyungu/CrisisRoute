"""GDACS RSS feed poller — live global disaster data into Firestore."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone

import feedparser
import httpx

from src.models.incident import Incident, IncidentSeverity, IncidentType
from src.services.firebase import get_db

GDACS_RSS_URL = "https://www.gdacs.org/xml/rss.xml"
MOCK_INCIDENT_IDS = {"EQ-2026-istanbul-72"}

GDACS_TYPE_MAP = {
    "EQ": IncidentType.EARTHQUAKE,
    "TC": IncidentType.CYCLONE,
    "FL": IncidentType.FLOOD,
    "VO": IncidentType.VOLCANO,
    "DR": IncidentType.DROUGHT,
    "WF": IncidentType.WILDFIRE,
}

GDACS_ALERT_SEVERITY = {
    "Red": IncidentSeverity.CRITICAL,
    "Orange": IncidentSeverity.HIGH,
    "Green": IncidentSeverity.MEDIUM,
}

# Aid request templates keyed by incident type (realistic needs per disaster)
AID_TEMPLATES: dict[str, list[dict]] = {
    "earthquake": [
        {
            "title": "Search & rescue — collapsed structures",
            "description": "Structural damage reported. Need search & rescue teams with engineering assessment capability.",
            "required_skills": ["search_rescue", "engineering"],
            "urgency": "critical",
            "offset": (0.012, 0.008),
        },
        {
            "title": "Field triage & medical support",
            "description": "Injured civilians gathering at improvised aid points. Medical personnel needed for triage.",
            "required_skills": ["medical", "first_aid"],
            "urgency": "critical",
            "offset": (-0.010, 0.006),
        },
        {
            "title": "Emergency shelter coordination",
            "description": "Displaced residents need temporary shelter, blankets, and logistics coordination.",
            "required_skills": ["shelter_management", "logistics"],
            "urgency": "urgent",
            "offset": (0.006, -0.014),
        },
    ],
    "flood": [
        {
            "title": "Water rescue — stranded residents",
            "description": "Flooded areas with people trapped in buildings. Water rescue teams needed immediately.",
            "required_skills": ["water_rescue", "search_rescue"],
            "urgency": "critical",
            "offset": (0.015, 0.010),
        },
        {
            "title": "Relief supply distribution",
            "description": "Clean water, food, and dry clothing needed at evacuation centers.",
            "required_skills": ["logistics", "communication"],
            "urgency": "urgent",
            "offset": (-0.008, 0.012),
        },
    ],
    "wildfire": [
        {
            "title": "Evacuation support — fire perimeter",
            "description": "Communities near fire line need guided evacuation and traffic control.",
            "required_skills": ["driving", "communication", "logistics"],
            "urgency": "critical",
            "offset": (0.020, -0.005),
        },
        {
            "title": "Medical standby — smoke exposure",
            "description": "Respiratory injuries and smoke inhalation cases at evacuation points.",
            "required_skills": ["medical", "first_aid"],
            "urgency": "urgent",
            "offset": (-0.012, 0.018),
        },
    ],
    "cyclone": [
        {
            "title": "Debris clearance & rescue",
            "description": "Storm damage blocking roads. Search & rescue needed for trapped residents.",
            "required_skills": ["search_rescue", "engineering"],
            "urgency": "critical",
            "offset": (0.010, 0.015),
        },
        {
            "title": "Emergency communications hub",
            "description": "Cell towers down. Need comms volunteers to coordinate family reunification.",
            "required_skills": ["communication", "translation"],
            "urgency": "urgent",
            "offset": (-0.015, -0.008),
        },
    ],
    "volcano": [
        {
            "title": "Ash fall zone evacuation",
            "description": "Volcanic ash threatening respiratory health. Evacuation and medical support required.",
            "required_skills": ["medical", "driving", "logistics"],
            "urgency": "critical",
            "offset": (0.018, 0.006),
        },
    ],
    "drought": [
        {
            "title": "Water distribution points",
            "description": "Communities need organized water delivery and logistics support.",
            "required_skills": ["logistics", "driving"],
            "urgency": "urgent",
            "offset": (0.008, 0.010),
        },
    ],
    "other": [
        {
            "title": "On-site assessment & coordination",
            "description": "Disaster event requires volunteer assessment team on the ground.",
            "required_skills": ["communication", "logistics"],
            "urgency": "urgent",
            "offset": (0.005, 0.005),
        },
    ],
}

DEFAULT_TEMPLATES = AID_TEMPLATES["other"]


def _parse_severity_value(raw) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, dict):
        try:
            return float(raw.get("value", 0))
        except (TypeError, ValueError):
            return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _incident_doc_id(event_type: str, event_id: str) -> str:
    return f"GDACS-{event_type}-{event_id}"


def _map_severity(alert_level: str, event_type: str, severity_value: float | None) -> IncidentSeverity:
    base = GDACS_ALERT_SEVERITY.get(alert_level, IncidentSeverity.MEDIUM)
    if event_type == "EQ" and severity_value is not None:
        if severity_value >= 7.0:
            return IncidentSeverity.CRITICAL
        if severity_value >= 6.0 and base != IncidentSeverity.CRITICAL:
            return IncidentSeverity.HIGH
    return base


def _radius_km(event_type: str, severity_value: float | None, alert_level: str) -> float:
    if event_type == "EQ" and severity_value is not None:
        return max(15.0, min(120.0, severity_value * 12))
    if alert_level == "Red":
        return 80.0
    if alert_level == "Orange":
        return 50.0
    return 30.0


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


def _parse_entry(entry) -> Incident | None:
    event_type_code = getattr(entry, "gdacs_eventtype", "") or ""
    event_id = str(getattr(entry, "gdacs_eventid", "") or "")
    if not event_id:
        guid = entry.get("id", "") or entry.get("guid", "")
        event_id = guid.replace(event_type_code, "") if guid else hashlib.md5(
            entry.get("title", "").encode()
        ).hexdigest()[:12]

    lat = getattr(entry, "geo_lat", None)
    lng = getattr(entry, "geo_long", None)
    try:
        lat_f = float(lat) if lat is not None else 0.0
        lng_f = float(lng) if lng is not None else 0.0
    except (TypeError, ValueError):
        return None

    if lat_f == 0.0 and lng_f == 0.0:
        return None

    is_current = str(getattr(entry, "gdacs_iscurrent", "true")).lower() == "true"
    if not is_current:
        return None

    alert_level = getattr(entry, "gdacs_alertlevel", "Green") or "Green"
    severity_value = _parse_severity_value(getattr(entry, "gdacs_severity", None))
    event_type = GDACS_TYPE_MAP.get(event_type_code, IncidentType.OTHER)
    country = getattr(entry, "gdacs_country", "") or ""

    title = entry.get("title", "Unknown Event")
    if country and country not in title:
        title = f"{title} — {country}"

    description = _strip_html(entry.get("summary", "") or entry.get("description", ""))
    population = getattr(entry, "gdacs_population", None)
    if isinstance(population, dict) and population.get("value"):
        description += f" Population affected: {population.get('value')}."

    detected = getattr(entry, "gdacs_fromdate", "") or entry.get("published", "")
    if not detected:
        detected = datetime.now(timezone.utc).isoformat()

    return Incident(
        title=title,
        description=description,
        type=event_type,
        severity=_map_severity(alert_level, event_type_code, severity_value),
        latitude=lat_f,
        longitude=lng_f,
        radius_km=_radius_km(event_type_code, severity_value, alert_level),
        source="GDACS",
        source_id=_incident_doc_id(event_type_code, event_id),
        detected_at=detected,
        status="active",
    )


async def poll_gdacs_feed() -> list[Incident]:
    """Fetch and parse GDACS RSS feed, return normalized incidents."""
    async with httpx.AsyncClient() as client:
        response = await client.get(GDACS_RSS_URL, timeout=30, follow_redirects=True)
        response.raise_for_status()

    feed = feedparser.parse(response.text)
    incidents: list[Incident] = []

    for entry in feed.entries:
        incident = _parse_entry(entry)
        if incident:
            incidents.append(incident)

    return incidents


def _aid_request_doc_id(incident_id: str, index: int) -> str:
    return f"{incident_id}-req-{index:02d}"


def generate_aid_requests_for_incident(
    db,
    incident_id: str,
    incident: dict,
    *,
    skip_existing: bool = True,
) -> int:
    """Create contextual aid requests around a live incident epicenter."""
    type_key = incident.get("type", "other")
    templates = AID_TEMPLATES.get(type_key, DEFAULT_TEMPLATES)

    # More severe incidents get more request templates
    severity = incident.get("severity", "medium")
    if severity in ("critical", "high"):
        templates = templates
    elif severity == "medium":
        templates = templates[: max(2, len(templates) - 1)]
    else:
        templates = templates[:1]

    base_lat = incident.get("latitude", 0.0)
    base_lng = incident.get("longitude", 0.0)
    country = incident.get("title", "affected area")
    written = 0

    for i, tmpl in enumerate(templates):
        doc_id = _aid_request_doc_id(incident_id, i)
        ref = db.collection("aid_requests").document(doc_id)
        if skip_existing and ref.get().exists:
            existing = ref.get().to_dict() or {}
            if existing.get("status") != "open":
                continue
            continue

        dlat, dlng = tmpl.get("offset", (0.005 * (i + 1), 0.005 * (i + 1)))
        req_data = {
            "incident_id": incident_id,
            "title": tmpl["title"],
            "description": (
                f"[GDACS live — {country}] {tmpl['description']}"
            ),
            "required_skills": tmpl["required_skills"],
            "urgency": tmpl["urgency"],
            "latitude": round(base_lat + dlat, 4),
            "longitude": round(base_lng + dlng, 4),
            "status": "open",
            "requester_name": "GDACS Emergency Coordination",
            "requester_contact": "https://www.gdacs.org",
            "source": "GDACS",
        }
        ref.set(req_data, merge=True)
        written += 1

    return written


def _clear_mock_data(db) -> dict:
    """Remove Istanbul demo incident and related mock documents."""
    removed = {"incidents": 0, "aid_requests": 0, "missions": 0}

    for mock_id in MOCK_INCIDENT_IDS:
        ref = db.collection("incidents").document(mock_id)
        if ref.get().exists:
            ref.delete()
            removed["incidents"] += 1

    for doc in db.collection("incidents").stream():
        data = doc.to_dict() or {}
        if data.get("source") != "GDACS" and doc.id not in MOCK_INCIDENT_IDS:
            continue
        if doc.id in MOCK_INCIDENT_IDS:
            continue

    for doc in db.collection("aid_requests").stream():
        data = doc.to_dict() or {}
        if doc.id.startswith("demo-req-") or data.get("incident_id") in MOCK_INCIDENT_IDS:
            if data.get("status") == "open":
                doc.reference.delete()
                removed["aid_requests"] += 1

    for doc in db.collection("missions").stream():
        data = doc.to_dict() or {}
        if data.get("incident_id") in MOCK_INCIDENT_IDS and data.get("status") in (
            "assigned", "accepted", "en_route", "on_site",
        ):
            doc.reference.delete()
            removed["missions"] += 1

    return removed


async def ingest_incidents(
    *,
    replace_mock: bool = True,
    generate_aid_requests: bool = True,
) -> dict:
    """Poll GDACS and sync live incidents + aid requests to Firestore."""
    db = get_db()
    incidents = await poll_gdacs_feed()

    cleared = _clear_mock_data(db) if replace_mock else {"incidents": 0, "aid_requests": 0, "missions": 0}

    written = 0
    updated = 0
    aid_requests_created = 0
    live_ids: set[str] = set()

    for incident in incidents:
        doc_id = incident.source_id or hashlib.md5(incident.title.encode()).hexdigest()[:16]
        live_ids.add(doc_id)
        doc_ref = db.collection("incidents").document(doc_id)
        payload = incident.model_dump()
        payload["source"] = "GDACS"
        payload["live"] = True

        if doc_ref.get().exists:
            doc_ref.set(payload, merge=True)
            updated += 1
        else:
            doc_ref.set(payload)
            written += 1

        if generate_aid_requests:
            aid_requests_created += generate_aid_requests_for_incident(
                db, doc_id, payload, skip_existing=True
            )

    # Resolve mock-only incidents still marked active
    for doc in db.collection("incidents").where("status", "==", "active").stream():
        data = doc.to_dict() or {}
        if data.get("source") == "GDACS" and doc.id not in live_ids:
            doc.reference.update({"status": "resolved"})

    return {
        "source": "GDACS",
        "feed_url": GDACS_RSS_URL,
        "polled": len(incidents),
        "new_incidents": written,
        "updated_incidents": updated,
        "aid_requests_created": aid_requests_created,
        "mock_cleared": cleared,
        "active_live_incidents": len(live_ids),
    }
