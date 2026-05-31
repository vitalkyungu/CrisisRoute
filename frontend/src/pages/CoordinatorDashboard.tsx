import { useState, useEffect, useCallback } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { api } from "../lib/api";
import type { Incident, Volunteer, Mission, AidRequest, AgentLog, AgentStatus } from "../types";
import CoordinatorMap from "../components/CoordinatorMap";
import IncidentDetailPanel from "../components/IncidentDetailPanel";
import {
  AlertTriangle,
  Users,
  Activity,
  Radio,
  RefreshCw,
  Globe,
  Zap,
  ClipboardList,
  Bot,
  Clock,
} from "lucide-react";

export default function CoordinatorDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [aidRequests, setAidRequests] = useState<AidRequest[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentResult, setAgentResult] = useState<string>("");
  const [feedPolling, setFeedPolling] = useState(false);
  const [feedResult, setFeedResult] = useState<string>("");

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
      onSnapshot(collection(db, "aid_requests"), (snap) =>
        setAidRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AidRequest))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const refreshAgentData = useCallback(async () => {
    try {
      const [logs, status] = await Promise.all([
        api.agent.logs(20),
        api.agent.status(),
      ]);
      setAgentLogs(logs);
      setAgentStatus(status);
    } catch (e) {
      console.warn("Failed to load agent data:", e);
    }
  }, []);

  useEffect(() => {
    refreshAgentData();
    const interval = setInterval(refreshAgentData, 15000);
    return () => clearInterval(interval);
  }, [refreshAgentData]);

  const triggerAgent = async () => {
    setAgentRunning(true);
    setAgentResult("");
    try {
      const result = await api.agent.trigger();
      setAgentResult(result.summary || "Agent completed");
      await refreshAgentData();
    } catch (e: any) {
      setAgentResult(`Error: ${e.message}`);
    } finally {
      setAgentRunning(false);
    }
  };

  const pollFeeds = async () => {
    setFeedPolling(true);
    setFeedResult("");
    try {
      const result = await api.incidents.poll(true);
      const msg = [
        `${result.active_live_incidents ?? result.polled ?? 0} live GDACS event(s)`,
        result.new_incidents ? `${result.new_incidents} new` : null,
        result.aid_requests_created ? `${result.aid_requests_created} aid requests` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      setFeedResult(msg || "Feed synced");
      await refreshAgentData();
    } catch (e: any) {
      setFeedResult(`Feed error: ${e.message}`);
    } finally {
      setFeedPolling(false);
    }
  };

  useEffect(() => {
    pollFeeds();
  }, []);

  const activeIncidents = incidents.filter((i) => i.status === "active");
  const idleVolunteers = volunteers.filter((v) => v.status === "idle" && v.availability);
  const activeMissions = missions.filter(
    (m) => !["completed", "cancelled"].includes(m.status)
  );
  const completedMissions = missions.filter((m) => m.status === "completed");
  const openAidRequests = aidRequests.filter((r) => r.status === "open");
  const selectedIncident = activeIncidents.find((i) => i.id === selectedIncidentId) ?? null;
  const selectedIncidentRequests = selectedIncident
    ? openAidRequests.filter((r) => r.incident_id === selectedIncident.id).length
    : 0;

  const urgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "critical": return "badge-critical";
      case "urgent": return "badge-urgent";
      default: return "badge-standard";
    }
  };

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

  const formatTime = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <div>
      <div className="mb-4 rounded-lg border border-blue-800/40 bg-blue-950/20 px-4 py-3 text-sm text-slate-300">
        <span className="font-medium text-blue-300">You</span> oversee the operation here — sync disasters and deploy the agent.
        {" "}
        <span className="font-medium text-red-300">Gemini</span> is the AI coordinator that triages requests and assigns volunteers.
        Switch to <span className="font-medium text-slate-200">My Missions</span> to respond on the ground.
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Command Center</h1>
          <p className="text-slate-400 text-sm">Real-time disaster response coordination</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={pollFeeds}
            disabled={feedPolling}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${feedPolling ? "animate-spin" : ""}`} />
            {feedPolling ? "Syncing GDACS…" : "Sync Live Disasters"}
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

      {agentStatus && (
        <div className={`card mb-6 flex flex-wrap items-center gap-4 ${
          agentStatus.needs_agent_run ? "border-amber-600/50 bg-amber-950/20" : ""
        }`}>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-medium text-slate-200">Agent Status</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-slate-300">
              <span className="text-amber-400 font-bold">{agentStatus.pending_requests}</span> open requests
            </span>
            <span className="text-slate-300">
              <span className="text-blue-400 font-bold">{agentStatus.assigned_missions}</span> assigned
            </span>
            <span className="text-slate-300">
              <span className="text-green-400 font-bold">{agentStatus.available_volunteers}</span> available
            </span>
          </div>
          {agentStatus.needs_agent_run && (
            <span className="text-xs text-amber-400 ml-auto">Agent run recommended</span>
          )}
        </div>
      )}

      {feedResult && (
        <div className="card border-blue-700/50 bg-blue-950/20 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">Live GDACS Feed</span>
          </div>
          <p className="text-sm text-slate-300">{feedResult}</p>
        </div>
      )}

      {agentResult && (
        <div className="card border-green-700/50 bg-green-950/20 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">Agent Response</span>
          </div>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{agentResult}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold">{activeIncidents.length}</p>
            <p className="text-xs text-slate-400">Active Incidents</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-orange-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold">{openAidRequests.length}</p>
            <p className="text-xs text-slate-400">Open Requests</p>
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

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-3">Live Operations Map</h2>
        <CoordinatorMap
          incidents={activeIncidents}
          volunteers={volunteers}
          missions={activeMissions}
          focusIncidentId={selectedIncidentId}
          onIncidentSelect={setSelectedIncidentId}
        />
      </div>

      {selectedIncident && (
        <div className="mb-6">
          <IncidentDetailPanel
            incident={selectedIncident}
            relatedRequests={selectedIncidentRequests}
            onClose={() => setSelectedIncidentId(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Active Incidents</h2>
          <div className="space-y-3 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
            {activeIncidents.map((incident) => (
              <div
                key={incident.id}
                onClick={() => setSelectedIncidentId(incident.id === selectedIncidentId ? null : incident.id)}
                className={`card cursor-pointer transition-all hover:border-red-600/50 ${
                  selectedIncidentId === incident.id
                    ? "border-red-500/70 ring-1 ring-red-500/30"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-sm">{incident.title}</h3>
                  <span className={severityBadge(incident.severity)}>{incident.severity}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Click for full briefing · {incident.type} · {incident.radius_km}km
                  {incident.source === "GDACS" && (
                    <span className="text-blue-400"> · Live</span>
                  )}
                </p>
              </div>
            ))}
            {activeIncidents.length === 0 && (
              <p className="text-slate-500 text-sm">No active incidents</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Open Aid Requests</h2>
          <div className="space-y-3 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
            {openAidRequests
              .sort((a, b) => {
                const order = { critical: 0, urgent: 1, standard: 2 };
                return order[a.urgency] - order[b.urgency];
              })
              .map((request) => (
                <div key={request.id} className="card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm">{request.title}</h3>
                    <span className={urgencyBadge(request.urgency)}>{request.urgency}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-2">{request.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {request.required_skills?.slice(0, 3).map((skill) => (
                      <span key={skill} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                        {skill.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            {openAidRequests.length === 0 && (
              <p className="text-slate-500 text-sm">No open aid requests</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Active Missions</h2>
          <div className="space-y-3 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
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
                  <p className="text-xs text-slate-400 line-clamp-2">{mission.briefing}</p>
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

      <div>
        <h2 className="text-lg font-semibold mb-3">Agent Decision Log</h2>
        <div className="space-y-2 max-h-[320px] overflow-y-auto scrollbar-thin">
          {agentLogs.map((log) => (
            <div key={log.id} className="card py-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500">{formatTime(log.timestamp)}</span>
                {log.trigger && (
                  <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                    {log.trigger}
                  </span>
                )}
                {log.tool_call_count != null && (
                  <span className="text-xs text-slate-500 ml-auto">
                    {log.tool_call_count} tool calls
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 line-clamp-2">
                {log.result_summary || log.action || log.full_result || "Agent action logged"}
              </p>
            </div>
          ))}
          {agentLogs.length === 0 && (
            <p className="text-slate-500 text-sm">No agent logs yet. Deploy the agent to see decisions.</p>
          )}
        </div>
      </div>
    </div>
  );
}
