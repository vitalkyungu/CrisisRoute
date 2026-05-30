# CrisisRoute — Live Demo Script (2 minutes)

## Setup (before judges arrive)
1. Run `python scripts/seed_demo.py` to load Istanbul scenario
2. Open two browser tabs:
   - Tab 1: **Coordinator Command Center** (logged in as coordinator)
   - Tab 2: **Volunteer Dashboard** (logged in as Dr. Ayşe or Sophie)
3. Verify: Command Center shows 8 open requests, 20 available volunteers, 1 incident

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
