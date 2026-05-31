"""Mission route calculation with danger zone avoidance."""

from __future__ import annotations

import os

import googlemaps

from src.services.firebase import get_db
from src.services.maps import haversine_km


def _encode_polyline(points: list[tuple[float, float]]) -> str:
    """Encode lat/lng pairs into a Google Maps polyline string."""
    result: list[str] = []
    prev_lat = 0
    prev_lng = 0

    def encode_value(value: int) -> None:
        s = ~(value << 1) if value < 0 else (value << 1)
        while s >= 0x20:
            result.append(chr((0x20 | (s & 0x1F)) + 63))
            s >>= 5
        result.append(chr(s + 63))

    for lat, lng in points:
        lat_e5 = int(round(lat * 1e5))
        lng_e5 = int(round(lng * 1e5))
        encode_value(lat_e5 - prev_lat)
        encode_value(lng_e5 - prev_lng)
        prev_lat = lat_e5
        prev_lng = lng_e5

    return "".join(result)


def _avoidance_waypoint(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    epicenter_lat: float,
    epicenter_lng: float,
    radius_km: float,
) -> tuple[float, float]:
    radius_deg = radius_km * 0.012
    mid_lat = (origin_lat + dest_lat) / 2
    mid_lng = (origin_lng + dest_lng) / 2

    dlat = dest_lat - origin_lat
    dlng = dest_lng - origin_lng
    perp_lat = -dlng
    perp_lng = dlat
    norm = (perp_lat**2 + perp_lng**2) ** 0.5
    if norm == 0:
        return mid_lat, mid_lng

    avoid_lat = mid_lat + (perp_lat / norm) * radius_deg
    avoid_lng = mid_lng + (perp_lng / norm) * radius_deg

    if haversine_km(avoid_lat, avoid_lng, epicenter_lat, epicenter_lng) < haversine_km(
        mid_lat, mid_lng, epicenter_lat, epicenter_lng
    ):
        avoid_lat = mid_lat - (perp_lat / norm) * radius_deg
        avoid_lng = mid_lng - (perp_lng / norm) * radius_deg

    return avoid_lat, avoid_lng


def calculate_mission_route(mission_id: str) -> dict:
    """Compute safe driving route for a mission and persist to Firestore."""
    db = get_db()
    mission_ref = db.collection("missions").document(mission_id)
    mission_doc = mission_ref.get()
    if not mission_doc.exists:
        return {"error": f"Mission {mission_id} not found"}

    mission = mission_doc.to_dict()
    volunteer_id = mission.get("volunteer_id")
    if not volunteer_id:
        return {"error": "Mission has no volunteer_id"}

    vol_doc = db.collection("volunteers").document(volunteer_id).get()
    if not vol_doc.exists:
        return {"error": f"Volunteer {volunteer_id} not found"}

    volunteer = vol_doc.to_dict()
    origin_lat = volunteer["latitude"]
    origin_lng = volunteer["longitude"]

    dest_lat = dest_lng = None
    if mission.get("aid_request_id"):
        req_doc = db.collection("aid_requests").document(mission["aid_request_id"]).get()
        if req_doc.exists:
            req = req_doc.to_dict()
            dest_lat = req.get("latitude")
            dest_lng = req.get("longitude")

    if dest_lat is None or dest_lng is None:
        return {"error": "Could not resolve mission destination"}

    incident_id = mission.get("incident_id")
    waypoints: list[str] = []
    avoidance_point: tuple[float, float] | None = None

    if incident_id:
        inc_doc = db.collection("incidents").document(incident_id).get()
        if inc_doc.exists:
            inc = inc_doc.to_dict()
            avoid_lat, avoid_lng = _avoidance_waypoint(
                origin_lat,
                origin_lng,
                dest_lat,
                dest_lng,
                inc["latitude"],
                inc["longitude"],
                inc.get("radius_km", 5),
            )
            avoidance_point = (avoid_lat, avoid_lng)
            waypoints.append(f"via:{avoid_lat},{avoid_lng}")

    maps_key = os.getenv("GOOGLE_MAPS_API_KEY")
    result: dict

    if maps_key:
        try:
            client = googlemaps.Client(key=maps_key)
            directions = client.directions(
                origin=f"{origin_lat},{origin_lng}",
                destination=f"{dest_lat},{dest_lng}",
                waypoints=waypoints or None,
                mode="driving",
                departure_time="now",
            )
            if directions:
                route = directions[0]
                leg = route["legs"][0]
                result = {
                    "polyline": route["overview_polyline"]["points"],
                    "distance_meters": leg["distance"]["value"],
                    "duration_seconds": leg["duration"]["value"],
                    "danger_zone_avoided": bool(incident_id),
                    "fallback": False,
                }
            else:
                result = _fallback_route(
                    origin_lat, origin_lng, dest_lat, dest_lng, avoidance_point
                )
        except Exception as exc:
            result = _fallback_route(
                origin_lat, origin_lng, dest_lat, dest_lng, avoidance_point
            )
            result["maps_api_error"] = str(exc)
    else:
        result = _fallback_route(origin_lat, origin_lng, dest_lat, dest_lng, avoidance_point)

    if result.get("polyline"):
        mission_ref.update(
            {
                "route_polyline": result["polyline"],
                "eta_seconds": result.get("duration_seconds", 0),
                "distance_meters": result.get("distance_meters", 0),
            }
        )

    result["mission_id"] = mission_id
    return result


def _fallback_route(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    avoidance_point: tuple[float, float] | None,
) -> dict:
    points = [(origin_lat, origin_lng)]
    if avoidance_point:
        points.append(avoidance_point)
    points.append((dest_lat, dest_lng))

    distance = haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)
    if avoidance_point:
        distance = (
            haversine_km(origin_lat, origin_lng, avoidance_point[0], avoidance_point[1])
            + haversine_km(avoidance_point[0], avoidance_point[1], dest_lat, dest_lng)
        )

    eta_seconds = int((distance / 30) * 3600)

    return {
        "polyline": _encode_polyline(points),
        "distance_meters": int(distance * 1000),
        "duration_seconds": eta_seconds,
        "danger_zone_avoided": avoidance_point is not None,
        "fallback": True,
    }
