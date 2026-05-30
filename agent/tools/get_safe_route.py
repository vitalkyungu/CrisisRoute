"""ADK Tool: Calculate safe route from volunteer to incident, avoiding danger zones.

CRITICAL PATH: This tool provides the visual "proof of intelligence" —
the route that avoids the danger zone displayed on the volunteer's map.
"""

import os

import googlemaps


def get_safe_route(
    volunteer_id: str,
    destination_lat: float,
    destination_lng: float,
    incident_id: str | None = None,
) -> dict:
    """Calculate a driving route from volunteer's current location to the aid request location,
    automatically avoiding active danger zones (incident epicenters).
    
    Args:
        volunteer_id: Volunteer whose current location is the route origin
        destination_lat: Target latitude (where help is needed)
        destination_lng: Target longitude (where help is needed)
        incident_id: The incident to avoid — route will go AROUND this danger zone
    
    Returns route polyline (for map display), ETA, distance, and step-by-step directions.
    """
    from src.services.firebase import get_db
    from math import radians, cos, sin

    db = get_db()

    vol_doc = db.collection("volunteers").document(volunteer_id).get()
    if not vol_doc.exists:
        return {"error": f"Volunteer {volunteer_id} not found"}

    volunteer = vol_doc.to_dict()
    origin_lat = volunteer["latitude"]
    origin_lng = volunteer["longitude"]

    # Build danger zone avoidance waypoints
    waypoints = []
    danger_zone_info = None

    if incident_id:
        inc_doc = db.collection("incidents").document(incident_id).get()
        if inc_doc.exists:
            inc = inc_doc.to_dict()
            danger_zone_info = {
                "center_lat": inc["latitude"],
                "center_lng": inc["longitude"],
                "radius_km": inc.get("radius_km", 5),
                "type": inc.get("type", "unknown"),
            }

            # Calculate avoidance waypoint — offset perpendicular to the direct path
            # Push the route to go around the danger zone perimeter
            radius_deg = inc.get("radius_km", 5) * 0.012  # ~0.012 degrees per km
            mid_lat = (origin_lat + destination_lat) / 2
            mid_lng = (origin_lng + destination_lng) / 2

            # Determine which side to route around (away from epicenter)
            dlat = destination_lat - origin_lat
            dlng = destination_lng - origin_lng

            # Perpendicular offset (rotate 90 degrees)
            perp_lat = -dlng
            perp_lng = dlat
            norm = (perp_lat**2 + perp_lng**2) ** 0.5

            if norm > 0:
                # Offset the midpoint away from the danger zone center
                avoid_lat = mid_lat + (perp_lat / norm) * radius_deg
                avoid_lng = mid_lng + (perp_lng / norm) * radius_deg

                # Check if this pushes us TOWARD the epicenter; if so, flip
                from src.services.maps import haversine_km

                dist_original = haversine_km(mid_lat, mid_lng, inc["latitude"], inc["longitude"])
                dist_offset = haversine_km(avoid_lat, avoid_lng, inc["latitude"], inc["longitude"])

                if dist_offset < dist_original:
                    avoid_lat = mid_lat - (perp_lat / norm) * radius_deg
                    avoid_lng = mid_lng - (perp_lng / norm) * radius_deg

                waypoints.append(f"via:{avoid_lat},{avoid_lng}")

    # Call Google Maps Directions API
    maps_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not maps_key:
        return _fallback_route(origin_lat, origin_lng, destination_lat, destination_lng, danger_zone_info)

    try:
        client = googlemaps.Client(key=maps_key)
        directions = client.directions(
            origin=f"{origin_lat},{origin_lng}",
            destination=f"{destination_lat},{destination_lng}",
            waypoints=waypoints if waypoints else None,
            mode="driving",
            departure_time="now",
        )

        if not directions:
            return _fallback_route(origin_lat, origin_lng, destination_lat, destination_lng, danger_zone_info)

        route = directions[0]
        leg = route["legs"][0]

        result = {
            "polyline": route["overview_polyline"]["points"],
            "distance_text": leg["distance"]["text"],
            "distance_meters": leg["distance"]["value"],
            "duration_text": leg["duration"]["text"],
            "duration_seconds": leg["duration"]["value"],
            "danger_zone_avoided": danger_zone_info is not None,
            "avoidance_waypoints": waypoints,
        }

    except Exception as e:
        result = _fallback_route(origin_lat, origin_lng, destination_lat, destination_lng, danger_zone_info)
        result["maps_api_error"] = str(e)

    # Persist route to mission document
    if "error" not in result:
        missions = (
            db.collection("missions")
            .where("volunteer_id", "==", volunteer_id)
            .where("status", "==", "assigned")
            .stream()
        )
        for mission_doc in missions:
            mission_doc.reference.update({
                "route_polyline": result.get("polyline", ""),
                "eta_seconds": result.get("duration_seconds", 0),
                "distance_meters": result.get("distance_meters", 0),
            })

    return result


def _fallback_route(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
    danger_zone: dict | None,
) -> dict:
    """Fallback when Maps API is unavailable — estimate based on haversine distance."""
    from src.services.maps import haversine_km

    distance = haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)
    avg_speed_kmh = 30  # Conservative urban speed during disaster
    eta_seconds = int((distance / avg_speed_kmh) * 3600)

    return {
        "polyline": "",
        "distance_text": f"{distance:.1f} km",
        "distance_meters": int(distance * 1000),
        "duration_text": f"{eta_seconds // 60} mins",
        "duration_seconds": eta_seconds,
        "danger_zone_avoided": danger_zone is not None,
        "fallback": True,
        "note": "Estimated route — Maps API unavailable. Actual route should avoid danger zone.",
    }
