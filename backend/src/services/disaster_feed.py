"""GDACS RSS feed poller — parses disaster events into normalized schema."""

from datetime import datetime, timezone

import feedparser
import httpx

from src.models.incident import Incident, IncidentSeverity, IncidentType
from src.services.firebase import get_db

GDACS_RSS_URL = "https://www.gdacs.org/xml/rss.xml"

GDACS_TYPE_MAP = {
    "EQ": IncidentType.EARTHQUAKE,
    "TC": IncidentType.CYCLONE,
    "FL": IncidentType.FLOOD,
    "VO": IncidentType.VOLCANO,
    "DR": IncidentType.DROUGHT,
    "WF": IncidentType.WILDFIRE,
}

GDACS_SEVERITY_MAP = {
    "Green": IncidentSeverity.LOW,
    "Orange": IncidentSeverity.MEDIUM,
    "Red": IncidentSeverity.HIGH,
}


async def poll_gdacs_feed() -> list[Incident]:
    """Fetch and parse GDACS RSS feed, return normalized incidents."""
    async with httpx.AsyncClient() as client:
        response = await client.get(GDACS_RSS_URL, timeout=30)
        response.raise_for_status()

    feed = feedparser.parse(response.text)
    incidents = []

    for entry in feed.entries:
        event_type = GDACS_TYPE_MAP.get(
            getattr(entry, "gdacs_eventtype", ""), IncidentType.OTHER
        )
        severity = GDACS_SEVERITY_MAP.get(
            getattr(entry, "gdacs_alertlevel", ""), IncidentSeverity.MEDIUM
        )

        lat = float(getattr(entry, "geo_lat", 0))
        lng = float(getattr(entry, "geo_long", 0))

        incident = Incident(
            title=entry.get("title", "Unknown Event"),
            description=entry.get("summary", ""),
            type=event_type,
            severity=severity,
            latitude=lat,
            longitude=lng,
            radius_km=float(getattr(entry, "gdacs_severity", {}).get("value", 50)),
            source="GDACS",
            source_id=entry.get("id", ""),
            detected_at=datetime.now(timezone.utc).isoformat(),
            status="active",
        )
        incidents.append(incident)

    return incidents


async def ingest_incidents():
    """Poll feed and write new incidents to Firestore."""
    db = get_db()
    incidents = await poll_gdacs_feed()
    written = 0

    for incident in incidents:
        doc_ref = db.collection("incidents").document(incident.source_id)
        if not doc_ref.get().exists:
            doc_ref.set(incident.model_dump())
            written += 1

    return {"polled": len(incidents), "new_written": written}
