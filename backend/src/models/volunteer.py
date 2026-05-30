from pydantic import BaseModel, Field


class Volunteer(BaseModel):
    uid: str = ""
    display_name: str
    email: str
    phone: str = ""
    skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default=["en"])
    preferred_language: str = "en"
    latitude: float = 0.0
    longitude: float = 0.0
    availability: bool = True
    fcm_token: str = ""
    status: str = "idle"  # idle | en_route | on_site | unavailable


class VolunteerRegistration(BaseModel):
    display_name: str
    email: str
    phone: str = ""
    skills: list[str]
    languages: list[str] = Field(default=["en"])
    preferred_language: str = "en"
    latitude: float
    longitude: float
