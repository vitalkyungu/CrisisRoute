"""ADK Tool: Query available volunteers with skill and location filtering.

This is the matching engine — it finds the RIGHT volunteer for each request.
Scoring: skill match (60%) + proximity (30%) + language bonus (10%)
"""


def query_volunteers(
    required_skills: list[str] | None = None,
    latitude: float = 0.0,
    longitude: float = 0.0,
    radius_km: float = 50.0,
    preferred_language: str | None = None,
) -> dict:
    """Find available volunteers matching criteria, ranked by suitability.
    
    Args:
        required_skills: Skills needed for the mission (e.g. ["medical", "search_rescue"]).
            Volunteers with more matching skills rank higher.
        latitude: Center point latitude for proximity search (aid request location)
        longitude: Center point longitude for proximity search (aid request location)
        radius_km: Maximum distance from center point (default 50km, use 100km for critical)
        preferred_language: ISO language code — volunteers speaking this rank higher
    
    Returns a ranked list of volunteers with match scores.
    The agent should pick the FIRST volunteer (highest score) unless they have conflicts.
    """
    from src.services.firebase import get_db
    from src.services.maps import haversine_km

    db = get_db()

    all_volunteers = []
    for doc in (
        db.collection("volunteers")
        .where("availability", "==", True)
        .where("status", "==", "idle")
        .stream()
    ):
        vol = doc.to_dict()
        vol["id"] = doc.id
        all_volunteers.append(vol)

    if not all_volunteers:
        return {
            "volunteers": [],
            "total_available": 0,
            "message": "No available volunteers found. All are either unavailable or already assigned.",
        }

    # Calculate distance for all volunteers
    candidates = []
    for vol in all_volunteers:
        if latitude and longitude:
            dist = haversine_km(latitude, longitude, vol["latitude"], vol["longitude"])
            if dist > radius_km:
                continue
            vol["distance_km"] = round(dist, 2)
        else:
            vol["distance_km"] = 0.0
        candidates.append(vol)

    if not candidates:
        return {
            "volunteers": [],
            "total_available": 0,
            "message": f"No volunteers within {radius_km}km of the location.",
        }

    # Score each candidate
    max_distance = max(c["distance_km"] for c in candidates) or 1.0

    for vol in candidates:
        score = 0.0

        # Skill match score (0-60 points)
        if required_skills:
            vol_skills = set(vol.get("skills", []))
            required = set(required_skills)
            match_count = len(vol_skills & required)
            match_ratio = match_count / len(required) if required else 0
            vol["skill_match_ratio"] = round(match_ratio, 2)
            vol["matched_skills"] = list(vol_skills & required)
            vol["missing_skills"] = list(required - vol_skills)
            score += match_ratio * 60
        else:
            vol["skill_match_ratio"] = 1.0
            vol["matched_skills"] = vol.get("skills", [])
            vol["missing_skills"] = []
            score += 60

        # Proximity score (0-30 points) — closer is better
        proximity_ratio = 1.0 - (vol["distance_km"] / max_distance)
        score += proximity_ratio * 30

        # Language bonus (0-10 points)
        if preferred_language and preferred_language in vol.get("languages", []):
            vol["speaks_local_language"] = True
            score += 10
        else:
            vol["speaks_local_language"] = False

        vol["match_score"] = round(score, 1)

    # Sort by composite score (highest first)
    candidates = sorted(candidates, key=lambda v: v["match_score"], reverse=True)

    return {
        "volunteers": candidates[:10],
        "total_available": len(candidates),
        "best_match": candidates[0]["display_name"] if candidates else None,
        "best_score": candidates[0]["match_score"] if candidates else 0,
    }
