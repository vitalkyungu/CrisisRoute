"""Google Maps integration — routing with danger zone avoidance."""

import os
from math import asin, cos, radians, sin, sqrt

_gmaps = None


def get_maps_client():
    global _gmaps
    if _gmaps is None:
        import googlemaps
        _gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY"))
    return _gmaps


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers."""
    r = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


def get_volunteers_within_radius(
    volunteers: list[dict], lat: float, lng: float, radius_km: float
) -> list[dict]:
    """Filter volunteers within N km of a point."""
    nearby = []
    for vol in volunteers:
        dist = haversine_km(lat, lng, vol["latitude"], vol["longitude"])
        if dist <= radius_km:
            vol["distance_km"] = round(dist, 2)
            nearby.append(vol)
    return sorted(nearby, key=lambda v: v["distance_km"])


async def get_safe_route(
    origin: tuple[float, float],
    destination: tuple[float, float],
    danger_zones: list[dict] | None = None,
) -> dict:
    """Get directions avoiding danger zones using waypoint avoidance."""
    client = get_maps_client()

    avoid_params = {}
    waypoints = []

    if danger_zones:
        for zone in danger_zones:
            waypoints.append(
                f"via:{zone['avoidance_lat']},{zone['avoidance_lng']}"
            )

    directions = client.directions(
        origin=f"{origin[0]},{origin[1]}",
        destination=f"{destination[0]},{destination[1]}",
        waypoints=waypoints if waypoints else None,
        mode="driving",
        departure_time="now",
        **avoid_params,
    )

    if not directions:
        return {"error": "No route found"}

    route = directions[0]
    leg = route["legs"][0]

    return {
        "polyline": route["overview_polyline"]["points"],
        "distance_text": leg["distance"]["text"],
        "distance_meters": leg["distance"]["value"],
        "duration_text": leg["duration"]["text"],
        "duration_seconds": leg["duration"]["value"],
        "steps": [
            {"instruction": step.get("html_instructions", ""), "distance": step["distance"]["text"]}
            for step in leg["steps"]
        ],
    }
