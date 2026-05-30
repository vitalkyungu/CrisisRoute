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
    return {"status": "healthy", "service": "crisisroute-backend"}
