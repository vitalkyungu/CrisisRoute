import type { Incident } from "../types";
import {
  AlertTriangle,
  X,
  MapPin,
  Clock,
  Radio,
  Globe,
  Activity,
  Droplets,
  Flame,
  Wind,
  Mountain,
  Sun,
  Shield,
} from "lucide-react";

interface IncidentDetailPanelProps {
  incident: Incident;
  relatedRequests?: number;
  onClose?: () => void;
  className?: string;
  /** Fits inside the disaster list card (left sidebar) */
  embedded?: boolean;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof AlertTriangle; accent: string }
> = {
  earthquake: { label: "Earthquake", icon: Activity, accent: "text-red-400" },
  flood: { label: "Flood", icon: Droplets, accent: "text-blue-400" },
  wildfire: { label: "Wildfire", icon: Flame, accent: "text-orange-400" },
  cyclone: { label: "Cyclone", icon: Wind, accent: "text-cyan-400" },
  volcano: { label: "Volcano", icon: Mountain, accent: "text-rose-400" },
  drought: { label: "Drought", icon: Sun, accent: "text-yellow-400" },
  other: { label: "Disaster Event", icon: AlertTriangle, accent: "text-slate-400" },
};

const SEVERITY_STYLES: Record<string, { border: string; badge: string; glow: string }> = {
  critical: {
    border: "border-red-500/60",
    badge: "badge-critical",
    glow: "from-red-950/40 to-slate-900",
  },
  high: {
    border: "border-orange-500/50",
    badge: "badge-critical",
    glow: "from-orange-950/30 to-slate-900",
  },
  medium: {
    border: "border-amber-500/40",
    badge: "badge-urgent",
    glow: "from-amber-950/20 to-slate-900",
  },
  low: {
    border: "border-slate-600/50",
    badge: "badge-standard",
    glow: "from-slate-800/50 to-slate-900",
  },
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function formatDetected(iso?: string): string {
  if (!iso) return "Time unknown";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function IncidentDetailPanel({
  incident,
  relatedRequests = 0,
  onClose,
  className = "",
  embedded = false,
}: IncidentDetailPanelProps) {
  const typeConfig = TYPE_CONFIG[incident.type] ?? TYPE_CONFIG.other;
  const severityStyle = SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES.medium;
  const TypeIcon = typeConfig.icon;
  const description = stripHtml(incident.description || "No detailed briefing available for this event.");

  const shellClass = embedded
    ? `rounded-lg border border-slate-700/80 bg-slate-900/90 ${className}`
    : `relative overflow-hidden rounded-xl border ${severityStyle.border} bg-gradient-to-br ${severityStyle.glow} ${className}`;

  return (
    <div className={shellClass}>
      {!embedded && <div className="absolute inset-0 bg-slate-900/40 pointer-events-none" />}

      <div className={`relative ${embedded ? "p-4" : "p-5 md:p-6"}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className={`shrink-0 p-2 rounded-lg bg-slate-800/80 border border-slate-700 ${typeConfig.accent}`}>
              <TypeIcon className={embedded ? "w-4 h-4" : "w-5 h-5"} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                {typeConfig.label}
                {incident.source === "GDACS" && (
                  <span className="ml-1.5 text-blue-400 normal-case tracking-normal font-medium">· Live GDACS</span>
                )}
              </p>
              <h3 className={`font-semibold text-slate-100 leading-snug ${embedded ? "text-sm line-clamp-2" : "text-lg"}`}>
                {incident.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={severityStyle.badge}>{incident.severity}</span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                aria-label="Close details"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <p className={`text-slate-300 leading-relaxed mb-4 ${embedded ? "text-xs" : "text-sm mb-5 max-w-3xl"}`}>
          {description}
        </p>

        <div className={`grid gap-2 ${embedded ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4 gap-3"}`}>
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-0.5">
              <Shield className="w-3 h-3" />
              Danger radius
            </div>
            <p className={`font-medium text-slate-200 ${embedded ? "text-xs" : "text-sm"}`}>{incident.radius_km} km</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-0.5">
              <MapPin className="w-3 h-3" />
              Epicenter
            </div>
            <p className={`font-medium text-slate-200 font-mono ${embedded ? "text-[10px]" : "text-sm"}`}>
              {incident.latitude.toFixed(2)}, {incident.longitude.toFixed(2)}
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-0.5">
              <Clock className="w-3 h-3" />
              Detected
            </div>
            <p className={`font-medium text-slate-200 ${embedded ? "text-xs" : "text-sm"}`}>{formatDetected(incident.detected_at)}</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-0.5">
              <Radio className="w-3 h-3" />
              Open requests
            </div>
            <p className={`font-medium text-slate-200 ${embedded ? "text-xs" : "text-sm"}`}>{relatedRequests}</p>
          </div>
        </div>

        {incident.source === "GDACS" && (
          <div className={`flex items-center gap-1.5 text-slate-500 ${embedded ? "mt-3 text-[10px]" : "mt-4 text-xs"}`}>
            <Globe className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="line-clamp-2">
              Sourced from{" "}
              <a
                href="https://www.gdacs.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline"
              >
                GDACS
              </a>
              {!embedded && " — Global Disaster Alert and Coordination System"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
