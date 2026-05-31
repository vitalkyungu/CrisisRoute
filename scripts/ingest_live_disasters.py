#!/usr/bin/env python3
"""Load live disaster data from GDACS (replaces Istanbul mock scenario).

Keeps existing volunteers. Clears mock incident + demo aid requests.

Usage:
  cd /Volumes/LaCie/CrisisRoute
  export GOOGLE_APPLICATION_CREDENTIALS=backend/crisisroute-firebase-adminsdk-fbsvc-f5dab70143.json
  python3 scripts/ingest_live_disasters.py

Then deploy the agent:
  curl -X POST http://localhost:8080/api/agent/run
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

import firebase_admin
from firebase_admin import credentials

from src.services.firebase import initialize_firebase
from src.services.disaster_feed import ingest_incidents


def init_firebase() -> None:
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service-account-key.json")
    if not firebase_admin._apps:
        if os.path.exists(cred_path):
            firebase_admin.initialize_app(credentials.Certificate(cred_path))
        else:
            firebase_admin.initialize_app()
    initialize_firebase()


async def main() -> None:
    print("=" * 60)
    print("  CrisisRoute — Live GDACS Disaster Ingest")
    print("=" * 60)
    print()
    print("Fetching real-time disasters from https://www.gdacs.org ...")
    print()

    result = await ingest_incidents(replace_mock=True, generate_aid_requests=True)

    print(f"  Source:              {result['source']}")
    print(f"  Events polled:       {result['polled']}")
    print(f"  New incidents:       {result['new_incidents']}")
    print(f"  Updated incidents:   {result['updated_incidents']}")
    print(f"  Aid requests created:{result['aid_requests_created']}")
    print(f"  Active live events:  {result['active_live_incidents']}")
    cleared = result.get("mock_cleared", {})
    if any(cleared.values()):
        print(f"  Mock data cleared:   {cleared}")
    print()
    print("  Open Command Center → Poll Feeds shows live GDACS incidents on the map.")
    print("  Deploy Agent to assign volunteers to open aid requests.")
    print()
    print("  curl -X POST http://localhost:8080/api/agent/run")


if __name__ == "__main__":
    init_firebase()
    asyncio.run(main())
