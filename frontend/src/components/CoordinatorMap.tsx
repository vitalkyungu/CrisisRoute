import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "../lib/googleMapsLoader";
import type { Incident, Volunteer, Mission, CivicReport } from "../types";

interface CoordinatorMapProps {
  incidents: Incident[];
  volunteers: Volunteer[];
  missions: Mission[];
  civicReports?: CivicReport[];
  focusIncidentId?: string | null;
  onIncidentSelect?: (incidentId: string) => void;
}

/**
 * Live command center map showing all incidents (red zones),
 * volunteers (colored dots by status), and active routes.
 */
export default function CoordinatorMap({
  incidents,
  volunteers,
  missions,
  civicReports = [],
  focusIncidentId,
  onIncidentSelect,
}: CoordinatorMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const overlaysRef = useRef<(google.maps.Circle | google.maps.Polyline)[]>([]);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        if (mapInstanceRef.current) {
          updateOverlays();
          return;
        }
        initMap();
      })
      .catch(() => {
        /* coordinator map fails silently */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) updateOverlays();
  }, [incidents, volunteers, missions, civicReports, onIncidentSelect]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusIncidentId) return;

    const incident = incidents.find((i) => i.id === focusIncidentId);
    if (!incident) return;

    const circle = new google.maps.Circle({
      center: { lat: incident.latitude, lng: incident.longitude },
      radius: incident.radius_km * 1000,
    });
    const bounds = circle.getBounds();
    if (bounds) map.fitBounds(bounds, 60);
  }, [focusIncidentId, incidents]);

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 41.0082, lng: 28.9784 },
      zoom: 11,
      styles: DARK_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
    });

    updateOverlays();
  }

  function updateOverlays() {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous overlays
    markersRef.current.forEach((m) => m.setMap(null));
    overlaysRef.current.forEach((o) => o.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];

    // Danger zones
    incidents.forEach((inc) => {
      if (inc.status !== "active") return;

      const circle = new google.maps.Circle({
        center: { lat: inc.latitude, lng: inc.longitude },
        radius: inc.radius_km * 1000,
        fillColor: "#dc2626",
        fillOpacity: 0.1,
        strokeColor: "#dc2626",
        strokeOpacity: 0.5,
        strokeWeight: 2,
        map,
      });
      overlaysRef.current.push(circle);

      const marker = new google.maps.Marker({
        position: { lat: inc.latitude, lng: inc.longitude },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#dc2626",
          fillOpacity: 0.8,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        title: inc.title,
      });
      if (onIncidentSelect) {
        marker.addListener("click", () => onIncidentSelect(inc.id));
      }
      markersRef.current.push(marker);
    });

    // Volunteers
    volunteers.forEach((vol) => {
      const color = vol.status === "idle"
        ? "#22c55e"
        : vol.status === "en_route"
        ? "#f59e0b"
        : vol.status === "on_site"
        ? "#3b82f6"
        : "#6b7280";

      const marker = new google.maps.Marker({
        position: { lat: vol.latitude, lng: vol.longitude },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: "#fff",
          strokeWeight: 1.5,
        },
        title: `${vol.display_name} [${vol.status}]`,
      });
      markersRef.current.push(marker);
    });

    // Civic 311 pins
    civicReports.forEach((report) => {
      if (report.status === "completed") return;
      const marker = new google.maps.Marker({
        position: { lat: report.latitude, lng: report.longitude },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#d97706",
          fillOpacity: 0.9,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        title: report.title,
      });
      markersRef.current.push(marker);
    });

    // Active mission routes
    missions.forEach((mission) => {
      if (mission.route_polyline && window.google?.maps?.geometry) {
        try {
          const path = google.maps.geometry.encoding.decodePath(mission.route_polyline);
          const polyline = new google.maps.Polyline({
            path,
            strokeColor: "#22c55e",
            strokeOpacity: 0.7,
            strokeWeight: 3,
            map,
          });
          overlaysRef.current.push(polyline);
        } catch {
          // Invalid polyline — skip
        }
      }
    });
  }

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-96 rounded-lg bg-slate-700" />
      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-sm rounded-lg p-2.5 text-xs space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600" />
          <span className="text-slate-300">Incident zone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-slate-300">Volunteer (idle)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-slate-300">En route</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-slate-300">On site</span>
        </div>
        {civicReports.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-600" />
            <span className="text-slate-300">Civic 311</span>
          </div>
        )}
      </div>
    </div>
  );
}

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c4a6e" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#14532d" }] },
];
