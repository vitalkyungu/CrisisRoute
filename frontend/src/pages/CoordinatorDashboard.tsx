import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { api } from "../lib/api";
import type { Incident, Volunteer, Mission } from "../types";
import CoordinatorMap from "../components/CoordinatorMap";
import {
  AlertTriangle,
  Users,
  Activity,
  Radio,
  Play,
  RefreshCw,
  Globe,
  Zap,
} from "lucide-react";

export default function CoordinatorDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentResult, setAgentResult] = useState<string>("");

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "incidents"), (snap) =>
        setIncidents(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Incident))
      ),
      onSnapshot(collection(db, "volunteers"), (snap) =>
        setVolunteers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Volunteer))
      ),
      onSnapshot(collection(db, "missions"), (snap) =>
        setMissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Mission))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const triggerAgent = async () => {
    setAgentRunning(true);
    setAgentResult("");
    try {
      const result = await api.agent.trigger();
      setAgentResult(result.summary || "Agent completed");
    } catch (e: any) {
      setAgentResult(`Error: ${e.message}`);
    } finally {
      setAgentRunning(false);
    }
  };

  const pollFeeds = async () => {
    await api.incidents.poll();
  };

  const activeIncidents = incidents.filter((i) => i.status === "active");
  const idleVolunteers = volunteers.filter((v) => v.status === "idle" && v.availability);
  const activeMissions = missions.filter(
    (m) => !["completed", "cancelled"].includes(m.status)
  );
  const completedMissions = missions.filter((m) => m.status === "completed");

  const severityBadge = (severity: string) => {
    switch (severity) {
      case "critical": case "high": return "badge-critical";
      case "medium": return "badge-urgent";
      default: return "badge-standard";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "assigned": return "text-amber-400";
      case "accepted": return "text-blue-400";
      case "en_route": return "text-orange-400";
      case "on_site": return "text-green-400";
      default: return "text-slate-400";
    }
  };

  return (
    <div>
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Command Center</h1>
          <p className="text-slate-400 text-sm">Real-time disaster response coordination</p>
        </div>
        <div className="flex gap-3">
          <button onClick={pollFeeds} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Poll Feeds
          </button>
          <button
            onClick={triggerAgent}
            disabled={agentRunning}
            className="btn-primary flex items-center gap-2"
          >
            {agentRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Agent Running...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> Deploy Agent
              </>
            )}
          </button>
        </div>
      </div>

      {/* Agent result flash */}
      {agentResult && (
        <div className="card border-green-700/50 bg-green-950/20 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">Agent Response</span>
          </div>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{agentResult}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold">{activeIncidents.length}</p>
            <p className="text-xs text-slate-400">Active Incidents</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Users className="w-8 h-8 text-green-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold">{idleVolunteers.length}</p>
            <p className="text-xs text-slate-400">Available</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Activity className="w-8 h-8 text-amber-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold">{activeMissions.length}</p>
            <p className="text-xs text-slate-400">Active Missions</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Radio className="w-8 h-8 text-blue-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold">{completedMissions.length}</p>
            <p className="text-xs text-slate-400">Completed</p>
          </div>
        </div>
      </div>

      {/* Live map */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-3">Live Operations Map</h2>
        <CoordinatorMap
          incidents={activeIncidents}
          volunteers={volunteers}
          missions={activeMissions}
          focusIncidentId={selectedIncidentId}
        />
      </div>

      {/* Two-column detail view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active incidents */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Active Incidents</h2>
          <div className="space-y-3">
            {activeIncidents.map((incident) => (
              <div
                key={incident.id}
                onClick={() => setSelectedIncidentId(incident.id)}
                className={`card cursor-pointer transition-all hover:border-red-600/50 ${
                  selectedIncidentId === incident.id
                    ? "border-red-500/70 ring-1 ring-red-500/30"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-sm">{incident.title}</h3>
                  <span className={severityBadge(incident.severity)}>
                    {incident.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {incident.type} · {incident.radius_km}km radius ·{" "}
                  {incident.latitude.toFixed(3)}, {incident.longitude.toFixed(3)}
                </p>
              </div>
            ))}
            {activeIncidents.length === 0 && (
              <p className="text-slate-500 text-sm">No active incidents</p>
            )}
          </div>
        </div>

        {/* Active missions with volunteer assignments */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Active Missions</h2>
          <div className="space-y-3">
            {activeMissions.map((mission) => {
              const vol = volunteers.find((v) => v.id === mission.volunteer_id);
              return (
                <div key={mission.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold uppercase ${statusColor(mission.status)}`}>
                      {mission.status.replace("_", " ")}
                    </span>
                    {mission.eta_seconds > 0 && (
                      <span className="text-xs text-slate-500">
                        ETA {Math.round(mission.eta_seconds / 60)}min
                      </span>
                    )}
                  </div>
                  {vol && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-xs font-bold">
                        {vol.display_name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{vol.display_name}</span>
                      <Globe className="w-3 h-3 text-slate-500 ml-1" />
                      <span className="text-xs text-slate-500">{vol.preferred_language}</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {mission.briefing}
                  </p>
                </div>
              );
            })}
            {activeMissions.length === 0 && (
              <p className="text-slate-500 text-sm">
                No active missions. Press "Deploy Agent" to process open requests.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
