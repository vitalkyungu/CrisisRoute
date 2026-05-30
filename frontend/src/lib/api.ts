const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  incidents: {
    list: (status = "active") => request<any[]>(`/incidents/?status=${status}`),
    get: (id: string) => request<any>(`/incidents/${id}`),
    poll: () => request<any>("/incidents/poll", { method: "POST" }),
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
  },
};
