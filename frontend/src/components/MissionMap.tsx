import { useEffect, useRef, useState } from "react";
import { kmBetween } from "../lib/maps";
import type { Mission, Incident } from "../types";

/** Only draw danger zone when the incident is near the volunteer or destination. */
function relevantIncident(
  incident: Incident | null,
  volunteerLocation: { lat: number; lng: number } | null,
  destination?: { lat: number; lng: number } | null
): Incident | null {
  if (!incident) return null;
  const epicenter = { lat: incident.latitude, lng: incident.longitude };
  const maxKm = 75;
  if (volunteerLocation && kmBetween(epicenter, volunteerLocation) <= maxKm) {
    return incident;
  }
  if (destination && kmBetween(epicenter, destination) <= maxKm) {
    return incident;
  }
  return null;
}

interface MissionMapProps {
  mission: Mission;
  incident: Incident | null;
  volunteerLocation: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number; label?: string } | null;
  loadingRoute?: boolean;
  /** Override map height — use `h-full min-h-[360px]` in flex layouts */
  mapClassName?: string;
  /** When browsing the disaster list, always pan to the selected incident */
  focusSelectedIncident?: boolean;
}

/**
 * CRITICAL PATH — WP4/WP6: The visual proof of intelligence.
 * Shows the volunteer's route avoiding the danger zone on a Google Map.
 * Judges immediately understand "the agent sent this volunteer AROUND the danger zone."
 */
export default function MissionMap({
  mission,
  incident,
  volunteerLocation,
  destination,
  loadingRoute = false,
  mapClassName,
  focusSelectedIncident = false,
}: MissionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const overlaysRef = useRef<(google.maps.Marker | google.maps.Circle | google.maps.Polyline)[]>([]);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [error, setError] = useState<string>("");

  function clearOverlays() {
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
  }

  function fitToIncidentZone(
    mapInstance: google.maps.Map,
    targetIncident: Incident,
    location?: { lat: number; lng: number } | null
  ) {
    const circle = new google.maps.Circle({
      center: { lat: targetIncident.latitude, lng: targetIncident.longitude },
      radius: targetIncident.radius_km * 1000,
    });
    const bounds = circle.getBounds();
    if (!bounds) return;
    if (location) bounds.extend(location);
    mapInstance.fitBounds(bounds, 60);
  }

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!apiKey || !mapRef.current) {
      setError("Google Maps API key not configured");
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    script.async = true;
    script.onload = () => initMap();
    script.onerror = () => setError("Failed to load Google Maps");
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  function displayIncident(): Incident | null {
    if (!incident) return null;
    if (focusSelectedIncident) return incident;
    return relevantIncident(incident, volunteerLocation, destination ?? null);
  }

  function initMap() {
    if (!mapRef.current) return;

    const zone = displayIncident();
    const center = zone
      ? { lat: zone.latitude, lng: zone.longitude }
      : volunteerLocation
        ? volunteerLocation
        : destination
          ? destination
          : { lat: 41.0082, lng: 28.9784 };

    const mapInstance = new google.maps.Map(mapRef.current, {
      center,
      zoom: 12,
      styles: DARK_MAP_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
    });

    setMap(mapInstance);
    renderOverlays(mapInstance);
  }

  function renderOverlays(mapInstance: google.maps.Map) {
    clearOverlays();

    const zone = displayIncident();

    // --- DANGER ZONE: Red semi-transparent polygon around incident epicenter ---
    if (zone) {
      const dangerCircle = new google.maps.Circle({
        center: { lat: zone.latitude, lng: zone.longitude },
        radius: zone.radius_km * 1000,
        fillColor: "#dc2626",
        fillOpacity: 0.15,
        strokeColor: "#dc2626",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        map: mapInstance,
      });
      overlaysRef.current.push(dangerCircle);

      const epicenterMarker = new google.maps.Marker({
        position: { lat: zone.latitude, lng: zone.longitude },
        map: mapInstance,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: "#dc2626",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        title: `⚠️ ${zone.title}`,
      });
      overlaysRef.current.push(epicenterMarker);
    }

    // --- VOLUNTEER MARKER: Blue dot showing current position ---
    if (volunteerLocation) {
      const volunteerMarker = new google.maps.Marker({
        position: volunteerLocation,
        map: mapInstance,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#3b82f6",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        title: "Your location",
      });
      overlaysRef.current.push(volunteerMarker);
    }

    // --- ROUTE POLYLINE: Decoded from mission.route_polyline ---
    if (mission.route_polyline && window.google?.maps?.geometry) {
      const path = google.maps.geometry.encoding.decodePath(mission.route_polyline);

      const routeLine = new google.maps.Polyline({
        path,
        strokeColor: "#22c55e",
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map: mapInstance,
      });
      overlaysRef.current.push(routeLine);

      const routeGlow = new google.maps.Polyline({
        path,
        strokeColor: "#22c55e",
        strokeOpacity: 0.3,
        strokeWeight: 12,
        map: mapInstance,
      });
      overlaysRef.current.push(routeGlow);

      if (path.length > 0) {
        const destPoint = destination
          ? { lat: destination.lat, lng: destination.lng }
          : path[path.length - 1];
        const destinationMarker = new google.maps.Marker({
          position: destPoint,
          map: mapInstance,
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 8,
            fillColor: "#22c55e",
            fillOpacity: 0.9,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          title: destination?.label || "Destination",
        });
        overlaysRef.current.push(destinationMarker);
      }

      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      if (volunteerLocation) bounds.extend(volunteerLocation);
      if (destination) bounds.extend(destination);
      if (zone) bounds.extend({ lat: zone.latitude, lng: zone.longitude });
      mapInstance.fitBounds(bounds, 60);
    } else if (destination) {
      const destMarker = new google.maps.Marker({
        position: destination,
        map: mapInstance,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 8,
          fillColor: "#22c55e",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        title: destination.label || "Destination",
      });
      overlaysRef.current.push(destMarker);

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(destination);
      if (volunteerLocation) bounds.extend(volunteerLocation);
      if (zone) {
        const circle = new google.maps.Circle({
          center: { lat: zone.latitude, lng: zone.longitude },
          radius: zone.radius_km * 1000,
        });
        const zoneBounds = circle.getBounds();
        if (zoneBounds) bounds.union(zoneBounds);
      }
      mapInstance.fitBounds(bounds, 60);
    } else if (zone) {
      fitToIncidentZone(mapInstance, zone, volunteerLocation);
    }
  }

  // Re-render overlays when mission data updates
  useEffect(() => {
    if (map) renderOverlays(map);
  }, [map, mission.route_polyline, incident?.id, volunteerLocation, destination, focusSelectedIncident]);

  if (error) {
    return (
      <div className="w-full h-64 bg-slate-700 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-sm">{error}</p>
          {mission.eta_seconds > 0 && (
            <div className="mt-3 text-slate-300">
              <p>ETA: {Math.round(mission.eta_seconds / 60)} min</p>
              <p>{(mission.distance_meters / 1000).toFixed(1)} km via safe route</p>
              {incident && (
                <p className="text-red-400 text-xs mt-1">
                  ⚠️ Route avoids {incident.radius_km}km danger zone
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div ref={mapRef} className={mapClassName ?? "w-full h-72 md:h-96 rounded-lg"} />
      {loadingRoute && (
        <div className="absolute inset-0 bg-slate-900/70 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-300">Calculating safe route…</p>
            <p className="text-xs text-slate-500 mt-1">Avoiding danger zone</p>
          </div>
        </div>
      )}
      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-sm rounded-lg p-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600" />
          <span className="text-slate-300">Danger zone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-slate-300">Safe route</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-slate-300">Your position</span>
        </div>
      </div>
    </div>
  );
}

// Dark theme map style for the crisis context
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c4a6e" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#14532d" }] },
];
