const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const err = await response.json();
      detail = err.detail || err.error || detail;
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return response.json();
}

export const api = {
  incidents: {
    list: (status = "active") => request<any[]>(`/incidents/?status=${status}`),
    get: (id: string) => request<any>(`/incidents/${id}`),
    poll: (replaceMock = true) =>
      request<any>(
        `/incidents/poll?replace_mock=${replaceMock}&generate_aid=true`,
        { method: "POST" }
      ),
  },
  volunteers: {
    list: (availableOnly = false) =>
      request<any[]>(`/volunteers/?available_only=${availableOnly}`),
    get: (id: string) => request<any>(`/volunteers/${id}`),
    register: (data: any) =>
      request<any>("/volunteers/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateLocation: (id: string, lat: number, lng: number) =>
      request<any>(`/volunteers/${id}/location?latitude=${lat}&longitude=${lng}`, {
        method: "PUT",
      }),
    nearby: (incidentId: string, radius = 50) =>
      request<any[]>(`/volunteers/nearby/${incidentId}?radius_km=${radius}`),
  },
  missions: {
    list: (status?: string) =>
      request<any[]>(`/missions/${status ? `?status=${status}` : ""}`),
    get: (id: string) => request<any>(`/missions/${id}`),
    updateStatus: (id: string, status: string) =>
      request<any>(`/missions/${id}/status?status=${status}`, { method: "PUT" }),
    calculateRoute: (id: string) =>
      request<any>(`/missions/${id}/route`, { method: "POST" }),
    createAidRequest: (data: any) =>
      request<any>("/missions/aid-request", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  agent: {
    trigger: () => request<any>("/agent/run", { method: "POST" }),
    reassign: (missionId: string, reason = "volunteer_declined") =>
      request<any>(`/agent/reassign/${missionId}?reason=${encodeURIComponent(reason)}`, {
        method: "POST",
      }),
    logs: (limit = 50) => request<any[]>(`/agent/logs?limit=${limit}`),
    status: () => request<any>("/agent/status"),
  },
  alerts: {
    logs: (missionId?: string) =>
      request<any[]>(`/alerts/logs${missionId ? `?mission_id=${missionId}` : ""}`),
    stats: () => request<any>("/alerts/stats"),
    sendWelcome: (volunteerId: string) =>
      request<any>(`/alerts/welcome/${volunteerId}`, { method: "POST" }),
    sendMission: (missionId: string) =>
      request<any>(`/alerts/mission/${missionId}`, { method: "POST" }),
  },
  goodDeeds: {
    post: (data: {
      posted_by: string;
      description: string;
      latitude: number;
      longitude: number;
      category?: string;
      time_window?: string;
    }) =>
      request<any>("/good-deeds/", { method: "POST", body: JSON.stringify(data) }),
    nearby: (lat: number, lng: number, radiusKm = 15, excludeUserId = "") =>
      request<any[]>(
        `/good-deeds/nearby?latitude=${lat}&longitude=${lng}&radius_km=${radiusKm}&exclude_user_id=${encodeURIComponent(excludeUserId)}`
      ),
    helping: (volunteerId: string) => request<any[]>(`/good-deeds/helping/${volunteerId}`),
    posted: (userId: string) => request<any[]>(`/good-deeds/posted/${userId}`),
    stats: (userId: string) => request<any>(`/good-deeds/stats/${userId}`),
    claim: (deedId: string, volunteerId: string) =>
      request<any>(`/good-deeds/${deedId}/claim`, {
        method: "POST",
        body: JSON.stringify({ volunteer_id: volunteerId }),
      }),
    complete: (deedId: string, volunteerId: string) =>
      request<any>(`/good-deeds/${deedId}/complete`, {
        method: "POST",
        body: JSON.stringify({ volunteer_id: volunteerId }),
      }),
  },
  civic: {
    sync: (places = "portland,eugene", mockOnly = false) =>
      request<any>(
        `/civic/sync?places=${encodeURIComponent(places)}&use_mock_fallback=true&mock_only=${mockOnly}`,
        { method: "POST" }
      ),
    nearby: (lat: number, lng: number, radiusKm = 25) =>
      request<any[]>(`/civic/nearby?latitude=${lat}&longitude=${lng}&radius_km=${radiusKm}`),
    checkingOut: (volunteerId: string) =>
      request<any[]>(`/civic/checking-out/${volunteerId}`),
    active: () => request<any[]>("/civic/active"),
    overseerSummary: () => request<any>("/civic/overseer/summary"),
    checkOut: (reportId: string, volunteerId: string) =>
      request<any>(`/civic/${reportId}/check-out`, {
        method: "POST",
        body: JSON.stringify({ volunteer_id: volunteerId }),
      }),
    complete: (reportId: string, volunteerId: string) =>
      request<any>(`/civic/${reportId}/complete`, {
        method: "POST",
        body: JSON.stringify({ volunteer_id: volunteerId }),
      }),
  },
};
