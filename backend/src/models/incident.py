from enum import Enum

from pydantic import BaseModel, Field


class IncidentType(str, Enum):
    EARTHQUAKE = "earthquake"
    FLOOD = "flood"
    WILDFIRE = "wildfire"
    CYCLONE = "cyclone"
    VOLCANO = "volcano"
    DROUGHT = "drought"
    OTHER = "other"


class IncidentSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Incident(BaseModel):
    title: str
    description: str = ""
    type: IncidentType
    severity: IncidentSeverity
    latitude: float
    longitude: float
    radius_km: float = Field(default=50.0, description="Affected area radius in km")
    source: str = "GDACS"
    source_id: str = ""
    detected_at: str = ""
    status: str = "active"
