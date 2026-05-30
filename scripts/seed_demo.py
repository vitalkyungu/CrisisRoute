"""Seed CrisisRoute with Istanbul M7.2 earthquake demo scenario.

CRITICAL PATH — WP7.1: This is what judges see. Not your code.

Scenario narrative for the demo:
- A M7.2 earthquake hits Istanbul at 3:24 AM local time
- 20 diverse volunteers are available with different skills and languages
- 8 aid requests of varying urgency need immediate response
- The agent processes them all in one autonomous loop

When the demo runs:
1. Agent triages: 4 critical, 3 urgent, 1 standard
2. Dr. Ayşe Demir (Turkish, medical) → assigned to field hospital
3. Sophie Martin (French, medical) → gets her briefing IN FRENCH
4. Ahmed Hassan (Arabic, logistics) → receives SMS in Arabic
5. Carlos Rodriguez (Spanish, search & rescue) → routed AROUND the epicenter

That's the winning moment: diverse volunteers, multilingual alerts, smart routing.

Run: python scripts/seed_demo.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials, firestore

cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service-account-key.json")
if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
else:
    firebase_admin.initialize_app()

db = firestore.client()

# ═══════════════════════════════════════════════════════════════
# THE INCIDENT — Istanbul M7.2 Earthquake
# ═══════════════════════════════════════════════════════════════

INCIDENT = {
    "title": "M7.2 Earthquake — Istanbul, Turkey",
    "description": (
        "A magnitude 7.2 earthquake struck Istanbul at 03:24 local time on May 30, 2026. "
        "Epicenter located in the Sea of Marmara, 15km south of the city center. "
        "Multiple building collapses reported in Beyoğlu and Fatih districts. "
        "Estimated 2.5 million people affected. Tsunami warning issued for coastal areas. "
        "Power and communications disrupted across European Istanbul."
    ),
    "type": "earthquake",
    "severity": "critical",
    "latitude": 41.0082,
    "longitude": 28.9784,
    "radius_km": 35,
    "source": "GDACS",
    "source_id": "EQ-2026-istanbul-72",
    "detected_at": "2026-05-30T00:24:00Z",
    "status": "active",
}

# ═══════════════════════════════════════════════════════════════
# 20 VOLUNTEERS — diverse skills, languages, locations
# Each positioned within 50km of Istanbul center
# ═══════════════════════════════════════════════════════════════

VOLUNTEERS = [
    # --- MEDICAL TEAM ---
    {
        "display_name": "Dr. Ayşe Demir",
        "email": "ayse.demir@example.com",
        "phone": "+905551000001",
        "skills": ["medical", "first_aid"],
        "languages": ["tr", "en"],
        "preferred_language": "tr",
        "latitude": 41.015,
        "longitude": 28.950,
    },
    {
        "display_name": "Sophie Martin",
        "email": "sophie.martin@example.com",
        "phone": "+33612345678",
        "skills": ["medical", "counseling"],
        "languages": ["fr", "en", "tr"],
        "preferred_language": "fr",
        "latitude": 41.050,
        "longitude": 28.990,
    },
    {
        "display_name": "Nadia Benali",
        "email": "nadia.benali@example.com",
        "phone": "+212600123456",
        "skills": ["medical", "first_aid", "counseling"],
        "languages": ["ar", "fr", "en"],
        "preferred_language": "fr",
        "latitude": 40.995,
        "longitude": 28.965,
    },
    {
        "display_name": "Yuki Tanaka",
        "email": "yuki.tanaka@example.com",
        "phone": "",
        "skills": ["medical", "translation"],
        "languages": ["en", "tr", "zh"],
        "preferred_language": "en",
        "latitude": 41.010,
        "longitude": 28.970,
    },
    {
        "display_name": "Elena Popov",
        "email": "elena.popov@example.com",
        "phone": "",
        "skills": ["medical", "water_rescue"],
        "languages": ["en", "tr"],
        "preferred_language": "en",
        "latitude": 41.030,
        "longitude": 28.980,
    },
    # --- SEARCH & RESCUE ---
    {
        "display_name": "Mehmet Yılmaz",
        "email": "mehmet.yilmaz@example.com",
        "phone": "+905552000002",
        "skills": ["search_rescue", "engineering"],
        "languages": ["tr"],
        "preferred_language": "tr",
        "latitude": 41.020,
        "longitude": 29.010,
    },
    {
        "display_name": "Carlos Rodriguez",
        "email": "carlos.rodriguez@example.com",
        "phone": "+34600123456",
        "skills": ["search_rescue", "firefighting"],
        "languages": ["es", "en"],
        "preferred_language": "es",
        "latitude": 41.030,
        "longitude": 28.920,
    },
    {
        "display_name": "Hans Mueller",
        "email": "hans.mueller@example.com",
        "phone": "+491701234567",
        "skills": ["engineering", "search_rescue"],
        "languages": ["de", "en"],
        "preferred_language": "de",
        "latitude": 40.990,
        "longitude": 29.000,
    },
    {
        "display_name": "Omar Farouk",
        "email": "omar.farouk@example.com",
        "phone": "+201001234567",
        "skills": ["search_rescue", "first_aid"],
        "languages": ["ar", "en", "fr"],
        "preferred_language": "ar",
        "latitude": 40.970,
        "longitude": 28.990,
    },
    {
        "display_name": "Emre Doğan",
        "email": "emre.dogan@example.com",
        "phone": "+905553000003",
        "skills": ["search_rescue", "driving", "firefighting"],
        "languages": ["tr", "en"],
        "preferred_language": "tr",
        "latitude": 41.008,
        "longitude": 28.992,
    },
    # --- FIREFIGHTING ---
    {
        "display_name": "İbrahim Çelik",
        "email": "ibrahim.celik@example.com",
        "phone": "+905554000004",
        "skills": ["firefighting", "search_rescue"],
        "languages": ["tr"],
        "preferred_language": "tr",
        "latitude": 41.005,
        "longitude": 28.985,
    },
    # --- LOGISTICS & DRIVING ---
    {
        "display_name": "Ahmed Hassan",
        "email": "ahmed.hassan@example.com",
        "phone": "+201112345678",
        "skills": ["logistics", "driving"],
        "languages": ["ar", "en", "tr"],
        "preferred_language": "ar",
        "latitude": 40.980,
        "longitude": 29.050,
    },
    {
        "display_name": "David Chen",
        "email": "david.chen@example.com",
        "phone": "",
        "skills": ["communication", "logistics", "driving"],
        "languages": ["en", "zh"],
        "preferred_language": "en",
        "latitude": 41.025,
        "longitude": 29.010,
    },
    {
        "display_name": "Ali Kaya",
        "email": "ali.kaya@example.com",
        "phone": "+905555000005",
        "skills": ["driving", "logistics", "communication"],
        "languages": ["tr", "en"],
        "preferred_language": "tr",
        "latitude": 41.010,
        "longitude": 29.030,
    },
    {
        "display_name": "Kenji Watanabe",
        "email": "kenji.watanabe@example.com",
        "phone": "",
        "skills": ["engineering", "logistics"],
        "languages": ["en", "tr"],
        "preferred_language": "en",
        "latitude": 41.000,
        "longitude": 29.040,
    },
    # --- SHELTER & SUPPORT ---
    {
        "display_name": "Fatma Öztürk",
        "email": "fatma.ozturk@example.com",
        "phone": "+905556000006",
        "skills": ["shelter_management", "logistics"],
        "languages": ["tr", "en"],
        "preferred_language": "tr",
        "latitude": 41.000,
        "longitude": 28.960,
    },
    {
        "display_name": "Zeynep Arslan",
        "email": "zeynep.arslan@example.com",
        "phone": "+905557000007",
        "skills": ["shelter_management", "first_aid"],
        "languages": ["tr", "en"],
        "preferred_language": "tr",
        "latitude": 41.015,
        "longitude": 28.970,
    },
    # --- COMMUNICATION & TRANSLATION ---
    {
        "display_name": "Leila Mansour",
        "email": "leila.mansour@example.com",
        "phone": "+9611234567",
        "skills": ["translation", "counseling", "communication"],
        "languages": ["ar", "fr", "en", "tr"],
        "preferred_language": "ar",
        "latitude": 41.040,
        "longitude": 28.960,
    },
    {
        "display_name": "James O'Brien",
        "email": "james.obrien@example.com",
        "phone": "+447700123456",
        "skills": ["communication", "logistics"],
        "languages": ["en"],
        "preferred_language": "en",
        "latitude": 41.040,
        "longitude": 29.020,
    },
    {
        "display_name": "Maria Silva",
        "email": "maria.silva@example.com",
        "phone": "+5511912345678",
        "skills": ["first_aid", "counseling"],
        "languages": ["pt", "en", "es"],
        "preferred_language": "pt",
        "latitude": 41.020,
        "longitude": 28.940,
    },
]

# ═══════════════════════════════════════════════════════════════
# 8 AID REQUESTS — ordered by urgency for demo narrative
# The agent will process critical first, showing triage intelligence
# ═══════════════════════════════════════════════════════════════

AID_REQUESTS = [
    # --- CRITICAL (4) — life-threatening, process first ---
    {
        "title": "Building collapse — trapped survivors in Beyoğlu",
        "description": (
            "6-story residential building collapsed at İstiklal Caddesi. "
            "Sounds heard from rubble — estimated 15-20 people trapped. "
            "Need search & rescue team with structural engineering knowledge IMMEDIATELY."
        ),
        "required_skills": ["search_rescue", "engineering"],
        "urgency": "critical",
        "latitude": 41.035,
        "longitude": 28.977,
    },
    {
        "title": "Field hospital setup — Taksim Square",
        "description": (
            "Over 200 injured people being brought to Taksim Square triage point. "
            "Need medical personnel to set up field hospital and begin triage. "
            "Multiple trauma injuries, crush wounds, and shock cases."
        ),
        "required_skills": ["medical", "first_aid"],
        "urgency": "critical",
        "latitude": 41.037,
        "longitude": 28.985,
    },
    {
        "title": "Gas leak — apartment complex in Fatih",
        "description": (
            "Major natural gas leak from ruptured pipeline in partially collapsed "
            "apartment block. Risk of explosion. Need firefighters to secure the area "
            "and shut off gas before rescue teams can enter."
        ),
        "required_skills": ["firefighting", "search_rescue"],
        "urgency": "critical",
        "latitude": 41.022,
        "longitude": 28.963,
    },
    {
        "title": "Elderly care home evacuation — Üsküdar",
        "description": (
            "Nursing home with 60 elderly residents requires immediate evacuation. "
            "Building structurally compromised — engineers say it could collapse within hours. "
            "Need drivers with medical support for safe transport."
        ),
        "required_skills": ["driving", "medical", "first_aid"],
        "urgency": "critical",
        "latitude": 41.028,
        "longitude": 28.952,
    },
    # --- URGENT (3) — time-sensitive but not immediately life-threatening ---
    {
        "title": "Emergency shelter setup — Sultanahmet Park",
        "description": (
            "3,000+ displaced residents gathering in Sultanahmet Park with no shelter. "
            "Night temperatures dropping to 8°C. Need shelter management team to "
            "organize tents, blankets, and temporary accommodation."
        ),
        "required_skills": ["shelter_management", "logistics"],
        "urgency": "urgent",
        "latitude": 41.006,
        "longitude": 28.976,
    },
    {
        "title": "Water & food distribution — Fatih district",
        "description": (
            "Relief supplies (water, food, blankets) arrived at Fatih mosque parking area "
            "but need organized distribution. 500+ families waiting. "
            "Need logistics team to prevent stampede and ensure fair distribution."
        ),
        "required_skills": ["logistics", "communication"],
        "urgency": "urgent",
        "latitude": 41.018,
        "longitude": 28.949,
    },
    {
        "title": "Psychological first aid — Kadıköy primary school",
        "description": (
            "Primary school children (ages 6-12) severely traumatized after building shook "
            "during early morning study session. Teachers overwhelmed. "
            "Need counselors for psychological first aid."
        ),
        "required_skills": ["counseling", "communication"],
        "urgency": "urgent",
        "latitude": 41.012,
        "longitude": 29.002,
    },
    # --- STANDARD (1) — important but not time-critical ---
    {
        "title": "Translation support — stranded foreign tourists at Grand Bazaar",
        "description": (
            "Group of 40 foreign tourists stranded near Grand Bazaar area. "
            "Multiple languages needed (Arabic, French, English, Spanish). "
            "Tourists are safe but confused and need coordination to reach evacuation points."
        ),
        "required_skills": ["translation", "communication"],
        "urgency": "standard",
        "latitude": 41.011,
        "longitude": 28.968,
    },
]


def seed():
    print("=" * 60)
    print("  CrisisRoute Demo Seeder — Istanbul M7.2 Scenario")
    print("=" * 60)
    print()

    # Clear existing demo data
    print("[1/4] Clearing existing demo data...")
    for collection_name in ["incidents", "volunteers", "aid_requests", "missions", "agent_logs", "alert_logs"]:
        docs = db.collection(collection_name).limit(100).stream()
        for doc in docs:
            doc.reference.delete()
    print("      ✓ Cleared all collections")

    # Seed incident
    print(f"\n[2/4] Creating incident: {INCIDENT['title']}")
    db.collection("incidents").document("EQ-2026-istanbul-72").set(INCIDENT)
    print(f"      ✓ Incident created (epicenter: {INCIDENT['latitude']}, {INCIDENT['longitude']})")

    # Seed volunteers
    print(f"\n[3/4] Creating {len(VOLUNTEERS)} volunteers...")
    for i, vol in enumerate(VOLUNTEERS):
        vol_data = {
            **vol,
            "uid": f"demo-vol-{i:03d}",
            "availability": True,
            "status": "idle",
            "fcm_token": f"demo-fcm-token-{i:03d}",
        }
        db.collection("volunteers").document(f"demo-vol-{i:03d}").set(vol_data)
        print(f"      ✓ {vol['display_name']:25s} [{', '.join(vol['skills'])}] — {vol['preferred_language']}")

    # Seed aid requests
    print(f"\n[4/4] Creating {len(AID_REQUESTS)} aid requests...")
    for i, req in enumerate(AID_REQUESTS):
        req_data = {
            **req,
            "incident_id": "EQ-2026-istanbul-72",
            "status": "open",
            "requester_name": "Istanbul AFAD Emergency Command",
            "requester_contact": "+90-212-000-0000",
        }
        db.collection("aid_requests").document(f"demo-req-{i:03d}").set(req_data)
        urgency_icon = {"critical": "🔴", "urgent": "🟠", "standard": "🔵"}[req["urgency"]]
        print(f"      {urgency_icon} [{req['urgency']:8s}] {req['title']}")

    print("\n" + "=" * 60)
    print("  DEMO READY")
    print("=" * 60)
    print(f"""
  Incident:     {INCIDENT['title']}
  Volunteers:   {len(VOLUNTEERS)} (5 medical, 5 rescue, 1 fire, 4 logistics, 3 shelter, 2 comms)
  Aid Requests: {len(AID_REQUESTS)} (4 critical, 3 urgent, 1 standard)

  Expected agent behavior:
  ─────────────────────────
  1. Triage: Process 4 critical requests FIRST
  2. Match:  Dr. Ayşe (Turkish, medical) → Field hospital
  3. Match:  Mehmet + Hans (rescue + engineering) → Building collapse
  4. Match:  İbrahim (firefighter) → Gas leak
  5. Route:  Carlos routed AROUND the epicenter to reach Beyoğlu
  6. Alert:  Sophie gets her briefing in FRENCH
  7. Alert:  Ahmed gets his assignment in ARABIC
  8. Alert:  Carlos gets his briefing in SPANISH

  To trigger the agent:
    curl -X POST http://localhost:8080/api/agent/run
""")


if __name__ == "__main__":
    seed()
