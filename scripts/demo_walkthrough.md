# CrisisRoute — Live Demo Script (2 minutes)

## Setup (before judges arrive)

**Project root:** `/Volumes/LaCie/CrisisRoute`  
Always run scripts from the repo root (not `backend/`).

```bash
cd /Volumes/LaCie/CrisisRoute

export GOOGLE_APPLICATION_CREDENTIALS=/Volumes/LaCie/CrisisRoute/backend/crisisroute-firebase-adminsdk-fbsvc-f5dab70143.json

# Terminal 1 — backend (must watch agent/ too — use start script)
/Volumes/LaCie/CrisisRoute/scripts/start_backend.sh

# Or manually:
# cd /Volumes/LaCie/CrisisRoute/backend
# uvicorn src.main:app --reload --port 8080 --reload-dir . --reload-dir ../agent

# Terminal 2 — frontend
cd /Volumes/LaCie/CrisisRoute/frontend
npm run dev
```

**Live disasters (replaces Istanbul mock):**

```bash
cd /Volumes/LaCie/CrisisRoute
export GOOGLE_APPLICATION_CREDENTIALS=/Volumes/LaCie/CrisisRoute/backend/crisisroute-firebase-adminsdk-fbsvc-f5dab70143.json

python3 scripts/ingest_live_disasters.py
curl -X POST http://localhost:8080/api/agent/run
```

Command Center also auto-syncs GDACS on load (**Sync Live Disasters** button).

**Demo mock scenario (Istanbul earthquake):**

```bash
python3 scripts/seed_demo.py
curl -X POST http://localhost:8080/api/agent/run
```

**Optional — assign a mission to your Google account** (instead of using demo volunteers):

```bash
cd /Volumes/LaCie/CrisisRoute
export GOOGLE_APPLICATION_CREDENTIALS=/Volumes/LaCie/CrisisRoute/backend/crisisroute-firebase-adminsdk-fbsvc-f5dab70143.json

python3 scripts/assign_mission_to_me.py --email vitalkabange77@gmail.com --create --near-me
```

**Browser tabs:**
- Tab 1: **Coordinator Command Center** — http://localhost:5173/coordinator
- Tab 2: **Volunteer Dashboard** — http://localhost:5173/volunteer (sign in with your Google account)

**Verify:** Command Center shows open requests + missions; Volunteer tab shows assigned mission after accept → map shows safe route.

**If agent returns `'async for' requires __aiter__`:** the backend is running stale agent code. Stop uvicorn (Ctrl+C) and restart with `scripts/start_backend.sh` (watches `agent/` for changes).

**Test welcome SMS** (after saving your **personal** mobile on Profile — not the Twilio `+1206…` sender):

```bash
curl -s http://localhost:8080/health   # twilio_configured should be true
curl -X POST http://localhost:8080/api/alerts/welcome/YOUR_FIREBASE_UID
```

On a Twilio trial account, the recipient number must be [verified in the Twilio console](https://console.twilio.com/us1/develop/phone-numbers/manage/verified).

---

## The Demo (2 minutes)

### [0:00] THE PROBLEM (15 seconds)
> "When disasters strike, the biggest failure isn't lack of volunteers — it's coordination. The right people end up in the wrong place because no one knows who's available, what skills they have, and how to reach them safely."

### [0:15] SHOW THE SITUATION (15 seconds)
*Show coordinator dashboard*
> "Istanbul has just been hit by a 7.2 earthquake. We have 8 aid requests — 4 are life-threatening. We have 20 volunteers with different skills and languages. Watch what happens when we press one button."

### [0:30] DEPLOY THE AGENT (30 seconds)
*Click "Deploy Agent" button*
> "Our Gemini-powered agent autonomously triages all requests by urgency, matches volunteers by skill and proximity, calculates safe routes that avoid the danger zone, and sends alerts — all in under 60 seconds."

*While waiting, narrate what's happening:*
> "Right now Gemini is reasoning: 'This building collapse needs search & rescue — Mehmet has those skills and he's closest. The field hospital needs a doctor — Dr. Ayşe is a medic 3km away.' It's making 8 decisions simultaneously."

### [1:00] THE MAGIC MOMENT (30 seconds)
*Switch to volunteer tab (Sophie Martin — French speaker)*
> "Now watch: Sophie Martin is a French-speaking doctor in Istanbul. She just received her mission briefing — automatically translated into French by Gemini."

*Show the push notification / mission card with French text*
> "She didn't have to speak Turkish. She didn't have to find the emergency. The system found HER."

### [1:30] THE MAP (20 seconds)
*Show the route map on volunteer dashboard*
> "Look at the route — it goes AROUND the earthquake epicenter. The agent calculated a safe path that avoids the 35km danger zone. The volunteer sees exactly where to go and how long it'll take."

### [1:50] WRAP UP (10 seconds)
> "From earthquake detection to volunteer dispatch: 47 seconds. 8 missions assigned. 5 languages supported. Zero human intervention. That's CrisisRoute."

---

## Key Numbers to Mention
- **Under 60 seconds** from detection to dispatch
- **8 simultaneous missions** assigned in one agent loop
- **5 languages** (Turkish, French, Arabic, Spanish, English)
- **20 volunteers** with 12 different skill types
- **Safe routing** that avoids the 35km danger zone

## Judge Q&A Answers

**Q: "How does this differ from just calling Gemini API?"**
> "We use Agent Development Kit (ADK), not raw API calls. The agent has tools — it can query Firestore, call Google Maps, send FCM notifications. It reasons about which tool to call and in what order. That's the difference between a chatbot and an agent."

**Q: "What happens if a volunteer declines?"**
> "The system auto-triggers a re-assignment loop. The agent cancels the mission, reopens the aid request, finds the next-best volunteer, and dispatches them — all without coordinator intervention."

**Q: "How do you handle the danger zone routing?"**
> "We calculate a perpendicular avoidance waypoint around the incident epicenter, then pass it to Google Maps Directions API. The route is physically pushed around the danger zone."

**Q: "Is this real-time?"**
> "Yes. Firestore real-time listeners update the coordinator map and volunteer dashboards instantly. When the agent assigns a mission, everyone sees it within 1 second."

**Q: "Could this actually work in a real disaster?"**
> "The core logic is production-ready. For a real deployment, you'd add: redundant SMS via multiple providers, offline-first sync for areas with poor connectivity, and integration with national emergency management systems like AFAD in Turkey."
