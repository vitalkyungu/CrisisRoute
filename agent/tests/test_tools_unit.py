"""Unit tests for agent tools with mock Firestore.

These tests validate that each tool works correctly in isolation,
and that the full loop can execute without crashing.

Run: pytest agent/tests/ -v
"""

import sys
import os
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


class MockDocSnapshot:
    def __init__(self, doc_id, data, exists=True):
        self.id = doc_id
        self._data = data
        self.exists = exists
        self.reference = MagicMock()
        self.reference.update = MagicMock()

    def to_dict(self):
        return self._data


class MockDocRef:
    def __init__(self, doc_id, data, exists=True):
        self._snapshot = MockDocSnapshot(doc_id, data, exists)
        self.id = doc_id

    def get(self):
        return self._snapshot

    def update(self, data):
        self._snapshot._data.update(data)

    def set(self, data):
        self._snapshot._data = data


def make_mock_db(incidents, volunteers, aid_requests, missions=None):
    """Create a mock Firestore client with test data."""
    db = MagicMock()

    def mock_collection(name):
        coll = MagicMock()

        if name == "incidents":
            docs = [MockDocSnapshot(f"inc-{i}", d) for i, d in enumerate(incidents)]
        elif name == "volunteers":
            docs = [MockDocSnapshot(f"vol-{i:03d}", d) for i, d in enumerate(volunteers)]
        elif name == "aid_requests":
            docs = [MockDocSnapshot(f"req-{i}", d) for i, d in enumerate(aid_requests)]
        elif name == "missions":
            docs = [MockDocSnapshot(f"mis-{i}", d) for i, d in enumerate(missions or [])]
        else:
            docs = []

        # Handle .where().where().stream() chaining
        def mock_where(*args, **kwargs):
            filtered = MagicMock()
            filtered.where = mock_where
            filtered.stream = MagicMock(return_value=iter(docs))
            filtered.order_by = MagicMock(return_value=filtered)
            filtered.limit = MagicMock(return_value=filtered)
            return filtered

        coll.where = mock_where
        coll.stream = MagicMock(return_value=iter(docs))

        def mock_document(doc_id):
            for d in docs:
                if d.id == doc_id:
                    return MockDocRef(doc_id, d._data)
            return MockDocRef(doc_id, {}, exists=False)

        coll.document = mock_document
        coll.add = MagicMock(return_value=(None, MagicMock(id="new-mission-001")))
        return coll

    db.collection = mock_collection
    return db


SAMPLE_INCIDENT = {
    "title": "M7.2 Earthquake - Istanbul",
    "type": "earthquake",
    "severity": "critical",
    "latitude": 41.0082,
    "longitude": 28.9784,
    "radius_km": 35,
    "status": "active",
    "detected_at": "2026-05-30T00:24:00Z",
}

SAMPLE_VOLUNTEER = {
    "uid": "vol-000",
    "display_name": "Dr. Ayşe Demir",
    "email": "ayse@example.com",
    "skills": ["medical", "first_aid"],
    "languages": ["tr", "en"],
    "preferred_language": "tr",
    "latitude": 41.015,
    "longitude": 28.95,
    "availability": True,
    "status": "idle",
    "fcm_token": "mock-token-123",
    "phone": "+905551234567",
}

SAMPLE_AID_REQUEST = {
    "title": "Field hospital needed - Taksim Square",
    "description": "Over 200 injured being brought to Taksim Square.",
    "required_skills": ["medical", "first_aid"],
    "urgency": "critical",
    "latitude": 41.037,
    "longitude": 28.985,
    "status": "open",
    "incident_id": "inc-0",
}


class TestGetActiveIncidents:
    @patch("src.services.firebase.get_db")
    def test_returns_incidents_and_requests(self, mock_get_db):
        mock_get_db.return_value = make_mock_db(
            incidents=[SAMPLE_INCIDENT],
            volunteers=[],
            aid_requests=[SAMPLE_AID_REQUEST],
        )
        from agent.tools.get_active_incidents import get_active_incidents

        result = get_active_incidents()

        assert result["incident_count"] == 1
        assert result["open_request_count"] == 1
        assert result["urgency_breakdown"]["critical"] == 1
        assert "SITUATION REPORT" in result["summary"]

    @patch("src.services.firebase.get_db")
    def test_empty_state(self, mock_get_db):
        mock_get_db.return_value = make_mock_db(
            incidents=[], volunteers=[], aid_requests=[]
        )
        from agent.tools.get_active_incidents import get_active_incidents

        result = get_active_incidents()

        assert result["incident_count"] == 0
        assert result["open_request_count"] == 0


class TestQueryVolunteers:
    @patch("src.services.firebase.get_db")
    def test_finds_matching_volunteer(self, mock_get_db):
        mock_get_db.return_value = make_mock_db(
            incidents=[],
            volunteers=[SAMPLE_VOLUNTEER],
            aid_requests=[],
        )
        from agent.tools.query_volunteers import query_volunteers

        result = query_volunteers(
            required_skills=["medical", "first_aid"],
            latitude=41.037,
            longitude=28.985,
            radius_km=50,
            preferred_language="tr",
        )

        assert result["total_available"] == 1
        assert result["volunteers"][0]["display_name"] == "Dr. Ayşe Demir"
        assert result["volunteers"][0]["skill_match_ratio"] == 1.0
        assert result["volunteers"][0]["speaks_local_language"] is True

    @patch("src.services.firebase.get_db")
    def test_no_volunteers_available(self, mock_get_db):
        mock_get_db.return_value = make_mock_db(
            incidents=[], volunteers=[], aid_requests=[]
        )
        from agent.tools.query_volunteers import query_volunteers

        result = query_volunteers(required_skills=["medical"])

        assert result["total_available"] == 0
        assert "No available volunteers" in result["message"]


class TestAssignMission:
    @patch("src.services.firebase.get_db")
    def test_successful_assignment(self, mock_get_db):
        mock_get_db.return_value = make_mock_db(
            incidents=[SAMPLE_INCIDENT],
            volunteers=[SAMPLE_VOLUNTEER],
            aid_requests=[SAMPLE_AID_REQUEST],
        )
        from agent.tools.assign_mission import assign_mission

        result = assign_mission(
            volunteer_id="vol-000",
            incident_id="inc-0",
            aid_request_id="req-0",
            briefing="Respond to field hospital setup at Taksim Square.",
        )

        assert "error" not in result
        assert result["status"] == "assigned"
        assert result["volunteer_name"] == "Dr. Ayşe Demir"
        assert "mission_id" in result

    @patch("src.services.firebase.get_db")
    def test_rejects_non_idle_volunteer(self, mock_get_db):
        busy_volunteer = {**SAMPLE_VOLUNTEER, "status": "en_route"}
        mock_get_db.return_value = make_mock_db(
            incidents=[SAMPLE_INCIDENT],
            volunteers=[busy_volunteer],
            aid_requests=[SAMPLE_AID_REQUEST],
        )
        from agent.tools.assign_mission import assign_mission

        result = assign_mission(
            volunteer_id="vol-000",
            incident_id="inc-0",
            aid_request_id="req-0",
            briefing="Test briefing",
        )

        assert "error" in result
        assert "not idle" in result["error"]


class TestGetSafeRoute:
    @patch("src.services.firebase.get_db")
    def test_fallback_when_no_maps_key(self, mock_get_db):
        mock_get_db.return_value = make_mock_db(
            incidents=[SAMPLE_INCIDENT],
            volunteers=[SAMPLE_VOLUNTEER],
            aid_requests=[],
        )
        # Ensure no Maps API key
        with patch.dict(os.environ, {"GOOGLE_MAPS_API_KEY": ""}):
            from agent.tools.get_safe_route import get_safe_route

            result = get_safe_route(
                volunteer_id="vol-000",
                destination_lat=41.037,
                destination_lng=28.985,
                incident_id="inc-0",
            )

        assert result["fallback"] is True
        assert result["danger_zone_avoided"] is True
        assert result["distance_meters"] > 0
        assert result["duration_seconds"] > 0


class TestUpdateMissionStatus:
    @patch("src.services.firebase.get_db")
    def test_cancel_frees_volunteer(self, mock_get_db):
        mission = {
            "volunteer_id": "vol-000",
            "aid_request_id": "req-0",
            "status": "assigned",
        }
        mock_get_db.return_value = make_mock_db(
            incidents=[],
            volunteers=[SAMPLE_VOLUNTEER],
            aid_requests=[SAMPLE_AID_REQUEST],
            missions=[mission],
        )
        from agent.tools.update_mission_status import update_mission_status

        result = update_mission_status(
            mission_id="mis-0",
            new_status="cancelled",
            reason="volunteer_declined",
        )

        assert result["new_status"] == "cancelled"
        assert result["volunteer_freed"] is True
        assert result["aid_request_reopened"] is True
