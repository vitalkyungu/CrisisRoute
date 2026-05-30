from pydantic import BaseModel, Field


class Mission(BaseModel):
    incident_id: str
    volunteer_id: str
    aid_request_id: str = ""
    status: str = "assigned"  # assigned | accepted | en_route | on_site | completed | cancelled
    briefing: str = ""
    translated_briefing: str = ""
    route_polyline: str = ""
    eta_seconds: int = 0
    distance_meters: int = 0
    assigned_at: str = ""
    completed_at: str = ""


class AidRequest(BaseModel):
    incident_id: str
    title: str
    description: str
    required_skills: list[str] = Field(default_factory=list)
    urgency: str = "standard"  # critical | urgent | standard
    latitude: float
    longitude: float
    status: str = "open"  # open | assigned | fulfilled
    requester_name: str = ""
    requester_contact: str = ""
