# CrisisRoute Firestore Schema

## Collections

### `/incidents/{incidentId}`
| Field | Type | Description |
|-------|------|-------------|
| title | string | Event title (e.g. "M7.2 Earthquake - Istanbul") |
| description | string | Detailed description |
| type | string | earthquake, flood, wildfire, cyclone, volcano, drought, other |
| severity | string | low, medium, high, critical |
| latitude | number | Epicenter latitude |
| longitude | number | Epicenter longitude |
| radius_km | number | Affected area radius in kilometers |
| source | string | Data source (GDACS, manual, etc.) |
| source_id | string | External ID for deduplication |
| detected_at | string | ISO 8601 timestamp |
| status | string | active, resolved |

### `/volunteers/{uid}`
| Field | Type | Description |
|-------|------|-------------|
| uid | string | Firebase Auth UID |
| display_name | string | Full name |
| email | string | Email address |
| phone | string | Phone number (for SMS fallback) |
| skills | array[string] | Skill tags (medical, search_rescue, etc.) |
| languages | array[string] | ISO language codes spoken |
| preferred_language | string | Language for mission briefings |
| latitude | number | Current latitude |
| longitude | number | Current longitude |
| availability | boolean | Whether volunteer is available |
| status | string | idle, assigned, en_route, on_site, unavailable |
| fcm_token | string | Firebase Cloud Messaging token |

### `/missions/{missionId}`
| Field | Type | Description |
|-------|------|-------------|
| incident_id | string | Reference to incident |
| volunteer_id | string | Reference to volunteer |
| aid_request_id | string | Reference to aid request |
| status | string | assigned, accepted, en_route, on_site, completed, cancelled |
| briefing | string | English mission briefing |
| translated_briefing | string | Briefing in volunteer's language |
| route_polyline | string | Encoded polyline for Google Maps |
| eta_seconds | number | Estimated travel time |
| distance_meters | number | Route distance |
| assigned_at | string | ISO 8601 timestamp |
| completed_at | string | ISO 8601 timestamp |

### `/aid_requests/{requestId}`
| Field | Type | Description |
|-------|------|-------------|
| incident_id | string | Parent incident |
| title | string | Short description of need |
| description | string | Detailed description |
| required_skills | array[string] | Skills needed |
| urgency | string | critical, urgent, standard |
| latitude | number | Where help is needed |
| longitude | number | Where help is needed |
| status | string | open, assigned, fulfilled |
| requester_name | string | Who submitted the request |
| requester_contact | string | Contact info |

### `/alert_logs/{logId}`
| Field | Type | Description |
|-------|------|-------------|
| volunteer_id | string | Target volunteer |
| mission_id | string | Related mission |
| channel | string | fcm, sms, none |
| status | string | sent, failed |
| briefing_preview | string | First 100 chars of briefing |

### `/agent_logs/{logId}`
| Field | Type | Description |
|-------|------|-------------|
| timestamp | string | ISO 8601 |
| trigger | string | scheduled, manual, decline_reassign |
| action | string | What the agent did |
| result_summary | string | Short summary of outcome |
| full_result | string | Complete agent response |
| mission_id | string | Related mission (if applicable) |
