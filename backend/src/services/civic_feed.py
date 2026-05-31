"""SeeClickFix + mock civic issue ingest into Firestore."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx

from src.services.firebase import get_db
from src.services.maps import haversine_km

SCF_BASE = "https://seeclickfix.com/api/v2/issues"
MOCK_PATH = Path(__file__).resolve().parents[2] / "data" / "eugene_civic_mock.json"
DEFAULT_PLACES = ("portland", "eugene")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _doc_id(source: str, external_id: str) -> str:
    return f"{source}-{external_id}"


async def _fetch_place_issues(place_url: str, per_page: int = 20) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                SCF_BASE,
                params={"place_url": place_url, "per_page": per_page},
            )
            resp.raise_for_status()
            return resp.json().get("issues") or []
    except Exception:
        return []


def _load_mock_issues() -> list[dict]:
    if not MOCK_PATH.exists():
        return []
    with open(MOCK_PATH, encoding="utf-8") as f:
        return json.load(f)


def _normalize_scf_issue(raw: dict, place: str) -> dict:
    req = raw.get("request_type") or {}
    org = req.get("organization") or "Public Works"
    return {
        "external_id": str(raw.get("id", "")),
        "source": "seeclickfix",
        "title": raw.get("summary") or "Civic issue",
        "description": raw.get("description") or "",
        "latitude": float(raw.get("lat", 0)),
        "longitude": float(raw.get("lng", 0)),
        "address": raw.get("address") or "",
        "category": (req.get("title") or "civic").lower().replace(" ", "_"),
        "department": org,
        "html_url": raw.get("html_url") or "",
        "photo_url": (raw.get("media") or {}).get("image_full") or "",
        "place": place,
        "scf_status": raw.get("status") or "Open",
    }


def _normalize_mock_issue(raw: dict) -> dict:
    return {
        "external_id": raw["external_id"],
        "source": "mock",
        "title": raw["summary"],
        "description": raw.get("description", ""),
        "latitude": float(raw["latitude"]),
        "longitude": float(raw["longitude"]),
        "address": raw.get("address", ""),
        "category": raw.get("category", "civic"),
        "department": raw.get("department", "Public Works"),
        "html_url": "",
        "photo_url": "",
        "place": "eugene",
        "scf_status": "Open",
    }


def _upsert_report(db, payload: dict) -> str:
    doc_id = _doc_id(payload["source"], payload["external_id"])
    ref = db.collection("civic_reports").document(doc_id)
    existing = ref.get()
    base = {
        **payload,
        "synced_at": _now_iso(),
    }
    if existing.exists:
        data = existing.to_dict() or {}
        # Preserve volunteer workflow state
        if data.get("status") in ("claimed", "completed"):
            base["status"] = data["status"]
            base["claimed_by"] = data.get("claimed_by", "")
            base["claimed_by_name"] = data.get("claimed_by_name", "")
            base["completed_at"] = data.get("completed_at", "")
        else:
            base["status"] = "open"
        ref.set(base, merge=True)
        return "updated"
    base["status"] = "open"
    base["claimed_by"] = ""
    base["claimed_by_name"] = ""
    base["completed_at"] = ""
    base["created_at"] = _now_iso()
    ref.set(base)
    return "new"


async def sync_civic_reports(
    places: list[str] | None = None,
    *,
    use_mock_fallback: bool = True,
    mock_only: bool = False,
) -> dict:
    db = get_db()
    place_list = places or list(DEFAULT_PLACES)
    fetched = 0
    new_count = 0
    updated_count = 0
    sources: list[str] = []

    if not mock_only:
        for place in place_list:
            issues = await _fetch_place_issues(place)
            sources.append(f"{place}:{len(issues)}")
            for raw in issues:
                payload = _normalize_scf_issue(raw, place)
                if not payload["external_id"]:
                    continue
                fetched += 1
                result = _upsert_report(db, payload)
                if result == "new":
                    new_count += 1
                else:
                    updated_count += 1

            # Eugene SeeClickFix feed is often empty — still seed local demo issues
            if place == "eugene" and use_mock_fallback and len(issues) == 0:
                mock_issues = _load_mock_issues()
                for raw in mock_issues:
                    payload = _normalize_mock_issue(raw)
                    fetched += 1
                    result = _upsert_report(db, payload)
                    if result == "new":
                        new_count += 1
                    else:
                        updated_count += 1
                sources.append(f"mock-eugene:{len(mock_issues)}")

    if mock_only or (use_mock_fallback and fetched == 0):
        for raw in _load_mock_issues():
            payload = _normalize_mock_issue(raw)
            fetched += 1
            result = _upsert_report(db, payload)
            if result == "new":
                new_count += 1
            else:
                updated_count += 1
        sources.append(f"mock:{len(_load_mock_issues())}")

    open_count = sum(
        1
        for doc in db.collection("civic_reports").stream()
        if (doc.to_dict() or {}).get("status") == "open"
    )
    claimed_count = sum(
        1
        for doc in db.collection("civic_reports").stream()
        if (doc.to_dict() or {}).get("status") == "claimed"
    )

    return {
        "fetched": fetched,
        "new_reports": new_count,
        "updated_reports": updated_count,
        "open_reports": open_count,
        "claimed_reports": claimed_count,
        "sources": sources,
        "used_mock": mock_only
        or (use_mock_fallback and ("mock:" in str(sources) or "mock-eugene:" in str(sources))),
    }
