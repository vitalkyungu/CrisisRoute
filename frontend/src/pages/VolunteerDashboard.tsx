import { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db, auth, onForegroundMessage } from "../lib/firebase";
import { api } from "../lib/api";
import { useNotifications } from "../hooks/useNotifications";
import type { Mission, Incident, AidRequest, CivicReport } from "../types";
import MissionMap from "../components/MissionMap";
import MissionAlertBanner from "../components/MissionAlertBanner";
import IncidentDetailPanel from "../components/IncidentDetailPanel";
import GoodDeedsFeed from "../components/GoodDeedsFeed";
import CivicPanel from "../components/CivicPanel";
import { googleMapsDirectionsUrl } from "../lib/maps";
import { MapPin, Clock, CheckCircle, Navigation, Shield, Globe, AlertTriangle, Radio, Maximize2, Minimize2, Loader2, ExternalLink } from "lucide-react";

export default function VolunteerDashboard() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [currentIncident, setCurrentIncident] = useState<Incident | null>(null);
  const [volunteerLocation, setVolunteerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [missionAlert, setMissionAlert] = useState<{ title: string; message: string } | null>(null);
  const [missionDestination, setMissionDestination] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [civicReports, setCivicReports] = useState<CivicReport[]>([]);
  const [pointsRefresh, setPointsRefresh] = useState(0);
  const knownMissionIds = useRef<Set<string>>(new Set());
  const initialMissionLoad = useRef(true);
  const { syncFcmTokenIfGranted } = useNotifications();

  const loadCivicReports = async (lat?: number, lng?: number) => {
    const user = auth.currentUser;
    const loc =
      lat != null && lng != null ? { lat, lng } : volunteerLocation;
    if (!user || !loc) return;
    try {
      const [nearby, checking] = await Promise.all([
        api.civic.nearby(loc.lat, loc.lng, 50),
        api.civic.checkingOut(user.uid),
      ]);
      const byId = new Map<string, CivicReport>();
      [...checking, ...nearby].forEach((r) => byId.set(r.id, r));
      setCivicReports(Array.from(byId.values()));
    } catch {
      setCivicReports([]);
    }
  };

  const handleLocationUpdate = (lat: number, lng: number) => {
    setVolunteerLocation({ lat, lng });
    loadCivicReports(lat, lng);
  };

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

    syncFcmTokenIfGranted(user.uid);

    onForegroundMessage((payload: any) => {
      const data = payload?.data || {};
      const title = payload?.notification?.title || "CrisisRoute";
      const body =
        payload?.notification?.body ||
        payload?.data?.briefing ||
        "You have a new update.";

      if (data.type === "good_deed_claimed" || data.type === "good_deed_completed") {
        if (Notification.permission === "granted") {
          new Notification(title, { body });
        }
        return;
      }

      setMissionAlert({ title, message: body });
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      }
    });
  }, [syncFcmTokenIfGranted]);

  useEffect(() => {
    loadCivicReports();
  }, [volunteerLocation]);

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

  useEffect(() => {
    const active = missions.find((m) => !["completed", "cancelled"].includes(m.status));
    if (!active?.aid_request_id) {
      if (active?.incident_id && currentIncident) {
        setMissionDestination({
          lat: currentIncident.latitude,
          lng: currentIncident.longitude,
          label: currentIncident.title,
        });
      } else {
        setMissionDestination(null);
      }
      return;
    }
    getDoc(doc(db, "aid_requests", active.aid_request_id)).then((snap) => {
      if (snap.exists()) {
        const req = { id: snap.id, ...snap.data() } as AidRequest;
        setMissionDestination({
          lat: req.latitude,
          lng: req.longitude,
          label: req.title,
        });
      } else if (currentIncident) {
        setMissionDestination({
          lat: currentIncident.latitude,
          lng: currentIncident.longitude,
          label: currentIncident.title,
        });
      }
    });
  }, [missions, currentIncident]);

  const activeMission = missions.find(
    (m) => !["completed", "cancelled"].includes(m.status)
  );

  const showMissionAlert = missionAlert && activeMission?.status === "assigned";

  // Calculate route if accepted but polyline missing (e.g. page refresh)
  useEffect(() => {
    if (
      !activeMission ||
      activeMission.status === "assigned" ||
      activeMission.route_polyline ||
      calculatingRoute
    ) {
      return;
    }
    setCalculatingRoute(true);
    api.missions
      .calculateRoute(activeMission.id)
      .catch((e) => {
        console.warn("Route calculation failed:", e);
        setCalculatingRoute(false);
      });
  }, [activeMission?.id, activeMission?.status, activeMission?.route_polyline]);

  useEffect(() => {
    if (activeMission?.route_polyline) {
      setCalculatingRoute(false);
    }
  }, [activeMission?.route_polyline]);

  const updateStatus = async (missionId: string, status: string) => {
    await api.missions.updateStatus(missionId, status);
  };

  const acceptMission = async (missionId: string) => {
    setMissionAlert(null);
    setAccepting(true);
    setCalculatingRoute(true);
    try {
      await updateStatus(missionId, "accepted");
      await api.missions.calculateRoute(missionId);
    } catch (e) {
      console.error("Accept/route failed:", e);
      setCalculatingRoute(false);
    } finally {
      setAccepting(false);
    }
  };

  const openGoogleMaps = () => {
    if (!missionDestination) return;
    const url = googleMapsDirectionsUrl(missionDestination, volunteerLocation);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const declineMission = async (missionId: string) => {
    setMissionAlert(null);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {showMissionAlert && (
        <MissionAlertBanner
          title={missionAlert.title}
          message={missionAlert.message}
          onDismiss={() => setMissionAlert(null)}
        />
      )}

      <h1 className="text-2xl font-bold mb-4">My Missions</h1>

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
                  <button
                    onClick={() => acceptMission(activeMission.id)}
                    disabled={accepting}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Accepting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" /> Accept Mission
                      </>
                    )}
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
                <>
                  <button onClick={() => updateStatus(activeMission.id, "en_route")} className="btn-primary flex items-center gap-2">
                    <Navigation className="w-4 h-4" /> I'm En Route
                  </button>
                  {missionDestination && (
                    <button onClick={openGoogleMaps} className="btn-secondary flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" /> Open in Google Maps
                    </button>
                  )}
                </>
              )}
              {activeMission.status === "en_route" && (
                <>
                  <button onClick={() => updateStatus(activeMission.id, "on_site")} className="btn-primary flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Arrived On Site
                  </button>
                  {missionDestination && (
                    <button onClick={openGoogleMaps} className="btn-secondary flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" /> Open in Google Maps
                    </button>
                  )}
                </>
              )}
              {activeMission.status === "on_site" && (
                <button onClick={() => updateStatus(activeMission.id, "completed")} className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700">
                  <CheckCircle className="w-4 h-4" /> Mission Complete
                </button>
              )}
            </div>
            {missionDestination && ["accepted", "en_route"].includes(activeMission.status) && (
              <p className="text-xs text-slate-500 mt-3">
                Destination: {missionDestination.label}
              </p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Safe Route — Avoiding Danger Zone
              </h2>
              {missionDestination && activeMission.status !== "assigned" && (
                <button
                  onClick={openGoogleMaps}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-950/60 border border-blue-800/50 px-2.5 py-1 rounded transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Google Maps
                </button>
              )}
            </div>
            <MissionMap
              mission={activeMission}
              incident={currentIncident}
              volunteerLocation={volunteerLocation}
              destination={missionDestination}
              loadingRoute={calculatingRoute && !activeMission.route_polyline}
              civicReports={civicReports}
              onLocationUpdate={handleLocationUpdate}
            />
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
              <div className="flex-1 flex min-h-0">
                {/* Sidebar: list + briefing */}
                <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col min-h-0">
                  <div className="p-3 space-y-2 max-h-[40%] overflow-y-auto scrollbar-thin shrink-0 border-b border-slate-700">
                    {incidents.map((inc) => (
                      <div
                        key={inc.id}
                        onClick={() => setCurrentIncident(currentIncident?.id === inc.id ? null : inc)}
                        className={`rounded-lg p-3 border cursor-pointer transition-all hover:border-amber-600/50 ${
                          currentIncident?.id === inc.id
                            ? "bg-slate-700 border-amber-500/70 ring-1 ring-amber-500/30"
                            : "bg-slate-900 border-slate-700"
                        }`}
                      >
                        <h3 className="font-medium text-sm mb-1 line-clamp-2 leading-snug">{inc.title}</h3>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${
                            inc.severity === "critical" ? "bg-red-900/50 text-red-400" :
                            inc.severity === "high" ? "bg-orange-900/50 text-orange-400" :
                            inc.severity === "medium" ? "bg-amber-900/50 text-amber-400" :
                            "bg-slate-800 text-slate-400"
                          }`}>
                            {inc.severity}
                          </span>
                          <span className="text-slate-500 capitalize">{inc.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin p-3 min-h-0">
                    {currentIncident ? (
                      <IncidentDetailPanel
                        incident={currentIncident}
                        embedded
                        onClose={() => setCurrentIncident(null)}
                      />
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-8">Select a disaster for briefing</p>
                    )}
                  </div>
                </div>

                {/* Map area */}
                <div className="flex-1 relative min-w-0 min-h-0">
                  <MissionMap
                    mission={{ route_polyline: "", eta_seconds: 0, distance_meters: 0 } as Mission}
                    incident={currentIncident}
                    volunteerLocation={volunteerLocation}
                    focusSelectedIncident
                    mapClassName="w-full h-full min-h-0 rounded-lg"
                    civicReports={civicReports}
                    onLocationUpdate={handleLocationUpdate}
                  />
                </div>
              </div>
            </div>
          )}

          {/* NORMAL VIEW */}
          <div className="space-y-4">
            {incidents.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[calc(100vh-9rem)]">
                {/* Left: list + briefing */}
                <div className="card border-amber-700/30 !p-4 flex flex-col min-h-0 max-h-[calc(100vh-9rem)]">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <h2 className="font-semibold text-amber-400">Active Disasters</h2>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                      {incidents.length} active
                    </span>
                  </div>

                  {/* ~3 items visible before scroll (≈76px each + gap) */}
                  <div className="max-h-[248px] shrink-0 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {incidents.map((inc) => (
                      <div
                        key={inc.id}
                        onClick={() => setCurrentIncident(currentIncident?.id === inc.id ? null : inc)}
                        className={`bg-slate-900 rounded-lg px-3 py-2.5 border cursor-pointer transition-all hover:border-amber-600/50 ${
                          currentIncident?.id === inc.id
                            ? "border-amber-500/70 ring-1 ring-amber-500/30 bg-slate-800/80"
                            : "border-slate-700"
                        }`}
                      >
                        <h3 className="font-medium text-sm mb-1 line-clamp-1 leading-snug">{inc.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${
                            inc.severity === "critical" ? "bg-red-900/50 text-red-400" :
                            inc.severity === "high" ? "bg-orange-900/50 text-orange-400" :
                            inc.severity === "medium" ? "bg-amber-900/50 text-amber-400" :
                            "bg-slate-800 text-slate-400"
                          }`}>
                            {inc.severity}
                          </span>
                          <span className="text-slate-500 capitalize">{inc.type}</span>
                          {inc.source === "GDACS" && (
                            <span className="text-blue-400/80">Live</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin mt-4 pt-4 border-t border-slate-700/60">
                    {currentIncident ? (
                      <IncidentDetailPanel
                        incident={currentIncident}
                        embedded
                        onClose={() => setCurrentIncident(null)}
                      />
                    ) : (
                      <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center px-6 rounded-lg border border-dashed border-slate-700 bg-slate-900/40">
                        <MapPin className="w-7 h-7 text-slate-600 mb-2" />
                        <p className="text-sm text-slate-500">Select a disaster above</p>
                        <p className="text-xs text-slate-600 mt-1">Briefing and stats appear here</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: map */}
                <div className="card relative !p-4 flex flex-col min-h-0 max-h-[calc(100vh-9rem)]">
                  <div className="flex items-center justify-between mb-3 shrink-0">
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
                  <div className="flex-1 min-h-[280px]">
                    <MissionMap
                      mission={{ route_polyline: "", eta_seconds: 0, distance_meters: 0 } as Mission}
                      incident={currentIncident}
                      volunteerLocation={volunteerLocation}
                      focusSelectedIncident
                      mapClassName="w-full h-full min-h-[280px] rounded-lg"
                      civicReports={civicReports}
                      onLocationUpdate={handleLocationUpdate}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 shrink-0">
                    {currentIncident
                      ? `Red zone = ${currentIncident.radius_km}km danger area around epicenter`
                      : "Select an incident to pan the map to its danger zone"
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Compact status — only when no incidents */}
            {incidents.length === 0 && (
              <>
                <div className="card text-center py-12">
                  <MapPin className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-slate-300 mb-2">All Clear</h2>
                  <p className="text-slate-500">No active disasters in your area.</p>
                </div>
                <div className="card text-center py-5 border-green-800/30 bg-green-950/10">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Radio className="w-5 h-5 text-green-500 animate-pulse" />
                    <h2 className="text-sm font-semibold text-slate-200">Standing By — Ready for Deployment</h2>
                  </div>
                  <p className="text-slate-400 text-xs max-w-lg mx-auto">
                    When your skills are matched to an aid request, you'll receive your mission briefing instantly.
                  </p>
                </div>
              </>
            )}
          </div>

          {!activeMission && volunteerLocation && (
            <section className="mt-10 pt-8 border-t border-slate-700/60 space-y-8">
              <CivicPanel
                latitude={volunteerLocation.lat}
                longitude={volunteerLocation.lng}
                onStatsRefresh={() => setPointsRefresh((n) => n + 1)}
                onCivicRefresh={loadCivicReports}
              />
              <GoodDeedsFeed
                latitude={volunteerLocation.lat}
                longitude={volunteerLocation.lng}
                refreshTrigger={pointsRefresh}
              />
            </section>
          )}
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
