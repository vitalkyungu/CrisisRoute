# CrisisRoute

**AI-powered disaster response coordination platform** — turns chaotic emergency response into an orchestrated, data-driven operation in under 60 seconds from incident detection to volunteer dispatch.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CrisisRoute Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐     ┌──────────────────────┐     ┌─────────────┐ │
│  │  GDACS Feed  │────▶│   Cloud Run Backend  │◀───▶│  Firestore  │ │
│  │  (RSS Poll)  │     │   (FastAPI + ADK)    │     │  Database   │ │
│  └──────────────┘     └──────────┬───────────┘     └──────┬──────┘ │
│                                  │                         │        │
│                     ┌────────────┼────────────┐            │        │
│                     ▼            ▼            ▼            │        │
│           ┌──────────────┐ ┌─────────┐ ┌──────────┐       │        │
│           │ Gemini Agent │ │  Maps   │ │   FCM    │       │        │
│           │  (ADK Core)  │ │ Routing │ │  Alerts  │       │        │
│           └──────────────┘ └─────────┘ └────┬─────┘       │        │
│                                             │              │        │
│                                             ▼              │        │
│                           ┌─────────────────────────┐      │        │
│                           │    React PWA Frontend   │◀─────┘        │
│                           │  (Volunteer + Command)  │               │
│                           └─────────────────────────┘               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| AI Agent | Gemini 2.0 Flash + Agent Development Kit (ADK) |
| Backend | Python, FastAPI, Cloud Run |
| Frontend | React 19, Vite, TailwindCSS, PWA |
| Database | Firebase Firestore (real-time sync) |
| Auth | Firebase Auth (Google Sign-In) |
| Maps | Google Maps Platform (Directions, JS API) |
| Alerts | Firebase Cloud Messaging + Twilio SMS |
| CI/CD | GitHub Actions → Cloud Run + Firebase Hosting |

## Google APIs Used

- **Gemini API** — AI reasoning, urgency classification, multilingual briefing generation
- **Agent Development Kit (ADK)** — Autonomous agent with tool-use capabilities
- **Google Maps Directions API** — Safe routing with danger zone avoidance
- **Google Maps JavaScript API** — Live map in coordinator command center
- **Firebase Auth** — Google Sign-In, role-based access (custom claims)
- **Cloud Firestore** — Real-time database for all entities
- **Firebase Cloud Messaging** — Push notifications to volunteer PWA
- **Cloud Run** — Serverless backend and agent deployment
- **Cloud Scheduler** — Periodic GDACS feed polling

## Project Structure

```
CrisisRoute/
├── backend/                # Cloud Run service (FastAPI)
│   ├── src/
│   │   ├── main.py        # FastAPI app entry
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Firebase, Maps, Alerts
│   │   └── models/        # Pydantic schemas
│   ├── Dockerfile
│   └── requirements.txt
├── agent/                  # ADK Agent
│   ├── src/
│   │   └── crisisroute_agent.py  # Agent definition + system prompt
│   ├── tools/             # ADK tool functions
│   └── prompts/           # System prompt documentation
├── frontend/              # React PWA (Vite)
│   ├── src/
│   │   ├── pages/         # Login, Dashboard, Command Center
│   │   ├── components/    # Layout, Map, Cards
│   │   ├── hooks/         # useAuth
│   │   └── lib/           # Firebase, API client
│   └── package.json
├── firebase/              # Firestore rules + indexes
├── shared/                # Schema documentation
├── scripts/               # Demo data seeding
└── .github/workflows/     # CI/CD pipeline
```

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- Google Cloud project with enabled APIs
- Firebase project

### 1. Clone and configure

```bash
git clone <repo-url>
cd CrisisRoute
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8080
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Seed demo data

```bash
python scripts/seed_demo.py
```

### 5. Trigger the AI agent

```bash
curl -X POST http://localhost:8080/api/agent/run
```

## How It Works

1. **Incident Detection** — GDACS RSS feed poller detects earthquake/flood/fire events
2. **Volunteer Matching** — Gemini agent queries available volunteers by skill + proximity
3. **Mission Assignment** — Agent creates mission, calculates safe route avoiding danger zones
4. **Multilingual Alert** — Briefing translated to volunteer's language, sent via push/SMS
5. **Live Coordination** — Coordinator sees all volunteers and incidents on live map
6. **Status Tracking** — Volunteer updates status: Accepted → En Route → On Site → Complete

## Demo Scenario

**Istanbul M7.2 Earthquake** — 20 volunteers with diverse skills, 8 aid requests ranging from critical (building collapse rescue) to standard (tourist translation support). The agent triages, matches, routes, and dispatches in a single reasoning loop.

## Team

| Role | Responsibility |
|------|---------------|
| Backend Engineer | Cloud Run, APIs, GDACS poller, Maps routing |
| Agent Engineer | ADK agent, Gemini prompts, tool implementations |
| Frontend Engineer | React PWA, command center, volunteer UI |
| PM / Demo Lead | Demo scenario, pitch deck, integration testing |
