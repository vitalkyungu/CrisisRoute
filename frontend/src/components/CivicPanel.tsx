import { useEffect, useState } from "react";
import { CheckCircle, Construction, ExternalLink, Loader2, MapPin, Navigation } from "lucide-react";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";
import { googleMapsDirectionsUrl } from "../lib/maps";
import type { CivicReport } from "../types";

interface CivicPanelProps {
  latitude: number;
  longitude: number;
  onStatsRefresh?: () => void;
  onCivicRefresh?: () => void;
}

export default function CivicPanel({ latitude, longitude, onStatsRefresh, onCivicRefresh }: CivicPanelProps) {
  const [open, setOpen] = useState<CivicReport[]>([]);
  const [checkingOut, setCheckingOut] = useState<CivicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const [nearby, active] = await Promise.all([
        api.civic.nearby(latitude, longitude),
        api.civic.checkingOut(user.uid),
      ]);
      setOpen(nearby);
      setCheckingOut(active);
    } catch {
      setOpen([]);
      setCheckingOut([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [latitude, longitude]);

  const checkOut = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;
    setActionId(id);
    setMessage("");
    try {
      await api.civic.checkOut(id, user.uid);
      setMessage("Checked out — tap the blue arrow for Google Maps directions, then mark complete.");
      await refresh();
      onCivicRefresh?.();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not check out");
    } finally {
      setActionId(null);
    }
  };

  const complete = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;
    setActionId(id);
    setMessage("");
    try {
      const result = await api.civic.complete(id, user.uid);
      setMessage(`+${result.points_earned ?? 10} points! Civic issue resolved.`);
      onStatsRefresh?.();
      await refresh();
      onCivicRefresh?.();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not complete");
    } finally {
      setActionId(null);
    }
  };

  const openDirections = (report: CivicReport) => {
    const dest = {
      lat: Number(report.latitude),
      lng: Number(report.longitude),
    };
    if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) return;
    const url = googleMapsDirectionsUrl(dest, { lat: latitude, lng: longitude });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const empty = !loading && open.length === 0 && checkingOut.length === 0;

  return (
    <div className="card border-amber-800/30 !p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Construction className="w-5 h-5 text-amber-400" />
        <h2 className="font-semibold text-amber-300">Civic Issues (311)</h2>
      </div>

      <p className="text-xs text-slate-500">
        Amber pins on the map. Tap <strong className="text-amber-400">Check it out</strong>, use{" "}
        <strong className="text-blue-400">blue arrow</strong> to open Google Maps, then{" "}
        <strong className="text-green-400">Mark complete (+10 pts)</strong>.
      </p>

      {message && (
        <p className="text-sm text-green-400 bg-green-950/30 border border-green-800/40 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading civic issues…
        </div>
      ) : (
        <div className="space-y-4">
          {checkingOut.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-green-400 mb-2">
                You're checking out ({checkingOut.length})
              </h3>
              <div className="space-y-2">
                {checkingOut.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-green-800/40 bg-slate-900/50 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">{r.title}</p>
                        {r.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.description}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{r.department || r.category}</p>
                      </div>
                      <span className="text-[10px] uppercase text-green-500/80 shrink-0">claimed</span>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-3">
                      <button
                        type="button"
                        onClick={() => complete(r.id)}
                        disabled={actionId === r.id}
                        className="btn-primary text-xs py-2 px-3 flex items-center gap-1 bg-green-600 hover:bg-green-700"
                      >
                        {actionId === r.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        Mark complete (+10 pts)
                      </button>

                      <button
                        type="button"
                        onClick={() => openDirections(r)}
                        title="Open in Google Maps"
                        aria-label="Open directions in Google Maps"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md transition-colors hover:bg-blue-500 active:scale-95"
                      >
                        <Navigation className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {open.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-2">
                Open nearby ({open.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {open.map((r) => (
                  <CivicCard key={r.id} report={r}>
                    <button
                      type="button"
                      onClick={() => checkOut(r.id)}
                      disabled={actionId === r.id}
                      className="btn-primary text-xs mt-2 py-1.5 px-3 bg-amber-600 hover:bg-amber-700"
                    >
                      {actionId === r.id ? "Checking out…" : "Check it out"}
                    </button>
                  </CivicCard>
                ))}
              </div>
            </section>
          )}

          {empty && (
            <p className="text-sm text-slate-500">
              No civic issues loaded — coordinator can sync from Command Center.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CivicCard({
  report,
  children,
}: {
  report: CivicReport;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-slate-200">{report.title}</p>
          {report.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{report.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
            <span>{report.department || report.category}</span>
            {report.distance_km != null && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {report.distance_km.toFixed(1)} km
              </span>
            )}
            {report.source === "seeclickfix" && (
              <span className="text-amber-500/80">Live 311</span>
            )}
          </div>
        </div>
        <span className="text-[10px] uppercase text-slate-600 shrink-0">{report.status}</span>
      </div>
      {report.html_url && (
        <a
          href={report.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mt-1"
        >
          <ExternalLink className="w-3 h-3" /> SeeClickFix
        </a>
      )}
      {children}
    </div>
  );
}
