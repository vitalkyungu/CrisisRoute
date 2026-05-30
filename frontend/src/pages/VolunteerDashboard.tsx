import { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db, auth, onForegroundMessage } from "../lib/firebase";
import { api } from "../lib/api";
import { useNotifications } from "../hooks/useNotifications";
import type { Mission, Incident } from "../types";
import MissionMap from "../components/MissionMap";
import MissionAlertBanner from "../components/MissionAlertBanner";
import { MapPin, Clock, CheckCircle, Navigation, Shield, Globe, AlertTriangle, Radio, Maximize2, Minimize2, Loader2 } from "lucide-react";

export default function VolunteerDashboard() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [currentIncident, setCurrentIncident] = useState<Incident | null>(null);
  const [volunteerLocation, setVolunteerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [missionAlert, setMissionAlert] = useState<{ title: string; message: string } | null>(null);
  const knownMissionIds = useRef<Set<string>>(new Set());
  const initialMissionLoad = useRef(true);
  const { saveFcmToken } = useNotifications();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMapFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    saveFcmToken(user.uid);

    onForegroundMessage((payload: any) => {
      const title = payload?.notification?.title || "New Mission Assignment";
      const body = payload?.notification?.body || payload?.data?.briefing || "Check your mission briefing.";
      setMissionAlert({ title, message: body });
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      }
    });
  }, [saveFcmToken]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Get volunteer's location from their profile
    getDoc(doc(db, "volunteers", user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setVolunteerLocation({ lat: data.latitude, lng: data.longitude });
      }
    });

    // Listen for active incidents
    const unsubIncidents = onSnapshot(collection(db, "incidents"), (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Incident)
        .filter((i) => i.status === "active");
      setIncidents(data);
      if (data.length > 0) setCurrentIncident(data[0]);
    });

    // Listen for missions assigned to this user
    const q = query(
      collection(db, "missions"),
      where("volunteer_id", "==", user.uid)
    );
    const unsubMissions = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Mission
      );
      setMissions(data.sort((a, b) => (b.assigned_at > a.assigned_at ? 1 : -1)));
      setLoading(false);

      if (!initialMissionLoad.current) {
        for (const mission of data) {
          if (
            mission.status === "assigned" &&
            !knownMissionIds.current.has(mission.id)
          ) {
            const briefing = mission.translated_briefing || mission.briefing;
            setMissionAlert({
              title: "New Mission Assigned",
              message: briefing?.slice(0, 200) || "You have a new mission. Open the app to view details.",
            });
            if (Notification.permission === "granted") {
              new Notification("New Mission Assigned", {
                body: briefing?.slice(0, 120) || "You have a new mission briefing.",
              });
            }
            try {
              navigator.vibrate?.(200);
            } catch {
              // vibration not supported
            }
          }
        }
      }

      data.forEach((m) => knownMissionIds.current.add(m.id));
      initialMissionLoad.current = false;

      const active = data.find((m) => !["completed", "cancelled"].includes(m.status));
      if (active?.incident_id) {
        const incSnap = await getDoc(doc(db, "incidents", active.incident_id));
        if (incSnap.exists()) {
          setCurrentIncident({ id: incSnap.id, ...incSnap.data() } as Incident);
        }
      }
    });

    return () => { unsubIncidents(); unsubMissions(); };
  }, []);

  const updateStatus = async (missionId: string, status: string) => {
    await api.missions.updateStatus(missionId, status);
  };

  const declineMission = async (missionId: string) => {
    setDeclining(true);
    try {
      await api.agent.reassign(missionId, "volunteer_declined");
    } catch (e: any) {
      console.error("Reassign failed, cancelling mission:", e);
      await api.missions.updateStatus(missionId, "cancelled");
    } finally {
      setDeclining(false);
    }
  };

  const activeMission = missions.find(
    (m) => !["completed", "cancelled"].includes(m.status)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {missionAlert && (
        <MissionAlertBanner
          title={missionAlert.title}
          message={missionAlert.message}
          onDismiss={() => setMissionAlert(null)}
        />
      )}

      <h1 className="text-2xl font-bold mb-6">My Missions</h1>

      {activeMission ? (
        /* ───── ACTIVE MISSION VIEW ───── */
        <div className="space-y-4">
          <div className="card border-red-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-red-400 uppercase tracking-wide">
                  Active Mission
                </span>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {activeMission.id.slice(0, 8)}
              </span>
            </div>

            <div className="bg-slate-900 rounded-lg p-4 mb-4 border border-slate-700">
              {activeMission.translated_briefing && activeMission.translated_briefing !== activeMission.briefing && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-blue-400 font-medium">Auto-translated by Gemini</span>
                </div>
              )}
              <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                {activeMission.translated_briefing || activeMission.briefing || "Awaiting briefing..."}
              </p>
            </div>

            {activeMission.eta_seconds > 0 && (
              <div className="flex items-center gap-6 mb-4 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="font-medium">{Math.round(activeMission.eta_seconds / 60)} min</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span className="font-medium">{(activeMission.distance_meters / 1000).toFixed(1)} km</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="font-medium text-green-400">Safe route</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {activeMission.status === "assigned" && (
                <>
                  <button onClick={() => updateStatus(activeMission.id, "accepted")} className="btn-primary flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Accept Mission
                  </button>
                  <button
                    onClick={() => declineMission(activeMission.id)}
                    disabled={declining}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    {declining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Reassigning...
                      </>
                    ) : (
                      "Decline"
                    )}
                  </button>
                </>
              )}
              {activeMission.status === "accepted" && (
                <button onClick={() => updateStatus(activeMission.id, "en_route")} className="btn-primary flex items-center gap-2">
                  <Navigation className="w-4 h-4" /> I'm En Route
                </button>
              )}
              {activeMission.status === "en_route" && (
                <button onClick={() => updateStatus(activeMission.id, "on_site")} className="btn-primary flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Arrived On Site
                </button>
              )}
              {activeMission.status === "on_site" && (
                <button onClick={() => updateStatus(activeMission.id, "completed")} className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700">
                  <CheckCircle className="w-4 h-4" /> Mission Complete
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Safe Route — Avoiding Danger Zone
            </h2>
            <MissionMap mission={activeMission} incident={currentIncident} volunteerLocation={volunteerLocation} />
          </div>
        </div>
      ) : (
        /* ───── STANDING BY VIEW — show what's happening ───── */
        <>
          {/* FULLSCREEN MAP OVERLAY */}
          {mapFullscreen && (
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
              {/* Fullscreen header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-slate-200">
                    {currentIncident?.title || "Situation Map"}
                  </span>
                  {currentIncident && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      currentIncident.severity === "critical" ? "bg-red-900/50 text-red-400" :
                      currentIncident.severity === "medium" ? "bg-amber-900/50 text-amber-400" :
                      "bg-slate-700 text-slate-400"
                    }`}>
                      {currentIncident.severity}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setMapFullscreen(false)}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg px-3 py-1.5 transition-colors text-sm"
                >
                  <Minimize2 className="w-4 h-4" /> Exit Fullscreen
                </button>
              </div>

              {/* Fullscreen map + sidebar */}
              <div className="flex-1 flex">
                {/* Sidebar: incident list */}
                <div className="w-72 bg-slate-800 border-r border-slate-700 overflow-y-auto scrollbar-thin p-3 space-y-2">
                  {incidents.map((inc) => (
                    <div
                      key={inc.id}
                      onClick={() => setCurrentIncident(inc)}
                      className={`rounded-lg p-3 border cursor-pointer transition-all hover:border-amber-600/50 ${
                        currentIncident?.id === inc.id
                          ? "bg-slate-700 border-amber-500/70 ring-1 ring-amber-500/30"
                          : "bg-slate-900 border-slate-700"
                      }`}
                    >
                      <h3 className="font-medium text-sm mb-1 line-clamp-1">{inc.title}</h3>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded font-medium ${
                          inc.severity === "critical" ? "bg-red-900/50 text-red-400" :
                          inc.severity === "high" ? "bg-orange-900/50 text-orange-400" :
                          inc.severity === "medium" ? "bg-amber-900/50 text-amber-400" :
                          "bg-slate-800 text-slate-400"
                        }`}>
                          {inc.severity}
                        </span>
                        <span className="text-slate-500">{inc.type}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Map area */}
                <div className="flex-1 relative">
                  <MissionMap
                    mission={{ route_polyline: "", eta_seconds: 0, distance_meters: 0 } as Mission}
                    incident={currentIncident}
                    volunteerLocation={volunteerLocation}
                  />
                </div>
              </div>
            </div>
          )}

          {/* NORMAL VIEW */}
          <div className="space-y-4">
            {incidents.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: scrollable disaster list */}
                <div className="card border-amber-700/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <h2 className="font-semibold text-amber-400">Active Disasters</h2>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                      {incidents.length} active
                    </span>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {incidents.map((inc) => (
                      <div
                        key={inc.id}
                        onClick={() => setCurrentIncident(inc)}
                        className={`bg-slate-900 rounded-lg p-3 border cursor-pointer transition-all hover:border-amber-600/50 ${
                          currentIncident?.id === inc.id
                            ? "border-amber-500/70 ring-1 ring-amber-500/30"
                            : "border-slate-700"
                        }`}
                      >
                        <h3 className="font-medium text-sm mb-1 line-clamp-1">{inc.title}</h3>
                        <p className="text-slate-400 text-xs line-clamp-2 mb-2">{inc.description?.slice(0, 120)}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${
                            inc.severity === "critical" ? "bg-red-900/50 text-red-400" :
                            inc.severity === "high" ? "bg-orange-900/50 text-orange-400" :
                            inc.severity === "medium" ? "bg-amber-900/50 text-amber-400" :
                            "bg-slate-800 text-slate-400"
                          }`}>
                            {inc.severity}
                          </span>
                          <span className="text-slate-500">{inc.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: map with fullscreen button */}
                <div className="card relative">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                      Situation Map
                    </h2>
                    <button
                      onClick={() => setMapFullscreen(true)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
                    </button>
                  </div>
                  <MissionMap
                    mission={{ route_polyline: "", eta_seconds: 0, distance_meters: 0 } as Mission}
                    incident={currentIncident}
                    volunteerLocation={volunteerLocation}
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    {currentIncident
                      ? `Red zone = ${currentIncident.title} (${currentIncident.radius_km}km radius). Click an incident to view it.`
                      : "Select an incident to see the danger zone."
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Status card */}
            <div className="card text-center py-6">
              <Radio className="w-10 h-10 text-green-500 mx-auto mb-2 animate-pulse" />
              <h2 className="text-lg font-semibold text-slate-200 mb-1">Standing By — Ready for Deployment</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                The AI coordinator is analyzing the situation. When your skills are matched
                to an aid request, you'll receive your mission briefing instantly.
              </p>
            </div>

            {/* No incidents fallback */}
            {incidents.length === 0 && (
              <div className="card text-center py-12">
                <MapPin className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-300 mb-2">All Clear</h2>
                <p className="text-slate-500">No active disasters in your area.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Completed missions history */}
      {missions.filter((m) => m.status === "completed").length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4 text-slate-400">Mission History</h2>
          <div className="space-y-3">
            {missions.filter((m) => m.status === "completed").map((mission) => (
              <div key={mission.id} className="card opacity-60">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-400">Completed</span>
                </div>
                <p className="text-sm text-slate-400 line-clamp-2">{mission.briefing}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
