"""Good deeds API."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class PostDeedRequest(BaseModel):
    posted_by: str
    description: str
    latitude: float
    longitude: float
    category: str = "errand"
    time_window: str = ""


class DeedActionRequest(BaseModel):
    volunteer_id: str


@router.post("/")
async def create_deed(body: PostDeedRequest):
    from src.services.good_deeds import post_deed

    result = await post_deed(
        body.posted_by,
        body.description,
        body.latitude,
        body.longitude,
        body.category,
        body.time_window,
    )
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/nearby")
async def nearby(
    latitude: float,
    longitude: float,
    radius_km: float = 15.0,
    exclude_user_id: str = "",
):
    from src.services.good_deeds import list_nearby_open_deeds

    return list_nearby_open_deeds(latitude, longitude, radius_km, exclude_user_id)


@router.get("/helping/{volunteer_id}")
async def helping(volunteer_id: str):
    from src.services.good_deeds import list_helping_deeds

    return list_helping_deeds(volunteer_id)


@router.get("/posted/{user_id}")
async def posted(user_id: str):
    from src.services.good_deeds import list_my_posted_deeds

    return list_my_posted_deeds(user_id)


@router.get("/stats/{user_id}")
async def stats(user_id: str):
    from src.services.good_deeds import get_volunteer_stats

    return get_volunteer_stats(user_id)


@router.post("/{deed_id}/claim")
async def claim(deed_id: str, body: DeedActionRequest):
    from src.services.good_deeds import claim_deed

    result = await claim_deed(deed_id, body.volunteer_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{deed_id}/complete")
async def complete(deed_id: str, body: DeedActionRequest):
    from src.services.good_deeds import complete_deed

    result = await complete_deed(deed_id, body.volunteer_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result
