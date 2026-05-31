"""Civic reports API — sync, checkout, complete, overseer."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class CivicActionRequest(BaseModel):
    volunteer_id: str


@router.post("/sync")
async def sync_civic(
    places: str = "portland,eugene",
    use_mock_fallback: bool = True,
    mock_only: bool = False,
):
    from src.services.civic_feed import sync_civic_reports

    place_list = [p.strip() for p in places.split(",") if p.strip()]
    return await sync_civic_reports(
        place_list,
        use_mock_fallback=use_mock_fallback,
        mock_only=mock_only,
    )


@router.get("/nearby")
async def nearby(latitude: float, longitude: float, radius_km: float = 25.0):
    from src.services.civic_reports import list_nearby_open

    return list_nearby_open(latitude, longitude, radius_km)


@router.get("/checking-out/{volunteer_id}")
async def checking_out(volunteer_id: str):
    from src.services.civic_reports import list_checking_out

    return list_checking_out(volunteer_id)


@router.get("/active")
async def active():
    from src.services.civic_reports import list_all_active

    return list_all_active()


@router.get("/overseer/summary")
async def overseer_summary():
    from src.services.civic_reports import generate_overseer_summary

    return await generate_overseer_summary()


@router.post("/{report_id}/check-out")
async def check_out(report_id: str, body: CivicActionRequest):
    from src.services.civic_reports import check_out_report

    result = await check_out_report(report_id, body.volunteer_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{report_id}/complete")
async def complete(report_id: str, body: CivicActionRequest):
    from src.services.civic_reports import complete_report

    result = await complete_report(report_id, body.volunteer_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result
