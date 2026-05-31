import sys
from pathlib import Path

# Project root + backend must be on path for `agent.*` and `src.*` imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]
for path in (PROJECT_ROOT, BACKEND_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from dotenv import load_dotenv

# Load backend/.env first (Twilio, Gemini, etc.)
load_dotenv(BACKEND_ROOT / ".env", override=True)
# Optional repo-root .env — do not override keys already set
load_dotenv(PROJECT_ROOT / ".env", override=False)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes import incidents, volunteers, missions, alerts, agent_trigger
from src.services.firebase import initialize_firebase

app = FastAPI(
    title="CrisisRoute API",
    description="AI-powered disaster response coordination backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

initialize_firebase()

app.include_router(incidents.router, prefix="/api/incidents", tags=["Incidents"])
app.include_router(volunteers.router, prefix="/api/volunteers", tags=["Volunteers"])
app.include_router(missions.router, prefix="/api/missions", tags=["Missions"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(agent_trigger.router, prefix="/api/agent", tags=["Agent"])


@app.get("/health")
async def health_check():
    import os
    return {
        "status": "healthy",
        "service": "crisisroute-backend",
        "twilio_configured": bool(
            os.getenv("TWILIO_ACCOUNT_SID")
            and os.getenv("TWILIO_AUTH_TOKEN")
            and os.getenv("TWILIO_PHONE_NUMBER")
        ),
    }
