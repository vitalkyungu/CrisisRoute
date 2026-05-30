export interface Incident {
  id: string;
  title: string;
  description: string;
  type: "earthquake" | "flood" | "wildfire" | "cyclone" | "volcano" | "drought" | "other";
  severity: "low" | "medium" | "high" | "critical";
  latitude: number;
  longitude: number;
  radius_km: number;
  source: string;
  detected_at: string;
  status: "active" | "resolved";
}

export interface Volunteer {
  id: string;
  uid: string;
  display_name: string;
  email: string;
  phone: string;
  skills: string[];
  languages: string[];
  preferred_language: string;
  latitude: number;
  longitude: number;
  availability: boolean;
  status: "idle" | "assigned" | "en_route" | "on_site" | "unavailable";
  fcm_token: string;
}

export interface Mission {
  id: string;
  incident_id: string;
  volunteer_id: string;
  aid_request_id: string;
  status: "assigned" | "accepted" | "en_route" | "on_site" | "completed" | "cancelled";
  briefing: string;
  translated_briefing: string;
  route_polyline: string;
  eta_seconds: number;
  distance_meters: number;
  assigned_at: string;
  completed_at: string;
}

export interface AidRequest {
  id: string;
  incident_id: string;
  title: string;
  description: string;
  required_skills: string[];
  urgency: "critical" | "urgent" | "standard";
  latitude: number;
  longitude: number;
  status: "open" | "assigned" | "fulfilled";
}

export type UserRole = "volunteer" | "coordinator";
