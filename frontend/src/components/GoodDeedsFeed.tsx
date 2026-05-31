import { useEffect, useState } from "react";
import { CheckCircle, HandHeart, Loader2, MapPin, UserCheck } from "lucide-react";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";
import type { GoodDeed, VolunteerStats } from "../types";
import PostDeedForm from "./PostDeedForm";
import StreakBadge from "./StreakBadge";

interface GoodDeedsFeedProps {
  latitude: number;
  longitude: number;
  refreshTrigger?: number;
}

function DeedCard({
  deed,
  children,
}: {
  deed: GoodDeed;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-slate-200">{deed.description}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
            <span className="capitalize">{deed.category.replace("_", " ")}</span>
            {deed.distance_km != null && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {deed.distance_km.toFixed(1)} km
              </span>
            )}
            {deed.time_window && <span>· {deed.time_window}</span>}
          </div>
          {deed.status === "claimed" && deed.claimed_by_name && (
            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              {deed.claimed_by_name} is helping
            </p>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-slate-600 shrink-0">
          {deed.status}
        </span>
      </div>
      {children}
    </div>
  );
}

export default function GoodDeedsFeed({
  latitude,
  longitude,
  refreshTrigger = 0,
}: GoodDeedsFeedProps) {
  const [nearby, setNearby] = useState<GoodDeed[]>([]);
  const [helping, setHelping] = useState<GoodDeed[]>([]);
  const [posted, setPosted] = useState<GoodDeed[]>([]);
  const [stats, setStats] = useState<VolunteerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const [openDeeds, helpingDeeds, postedDeeds, s] = await Promise.all([
        api.goodDeeds.nearby(latitude, longitude, 15, user.uid),
        api.goodDeeds.helping(user.uid),
        api.goodDeeds.posted(user.uid),
        api.goodDeeds.stats(user.uid),
      ]);
      setNearby(openDeeds);
      setHelping(helpingDeeds);
      setPosted(postedDeeds);
      setStats(s);
    } catch {
      setNearby([]);
      setHelping([]);
      setPosted([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [latitude, longitude, refreshTrigger]);

  const claim = async (deedId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    setActionId(deedId);
    setMessage("");
    try {
      await api.goodDeeds.claim(deedId, user.uid);
      setMessage("Claimed! Complete the help, then tap Mark complete for +10 pts.");
      await refresh();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not claim deed");
    } finally {
      setActionId(null);
    }
  };

  const complete = async (deedId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    setActionId(deedId);
    setMessage("");
    try {
      const result = await api.goodDeeds.complete(deedId, user.uid);
      if (result.stats) setStats(result.stats);
      setMessage(`+${result.points_earned ?? 10} points! Thanks for helping your community.`);
      await refresh();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not complete deed");
    } finally {
      setActionId(null);
    }
  };

  const empty =
    !loading && nearby.length === 0 && helping.length === 0 && posted.length === 0;

  return (
    <div className="card border-pink-800/30 !p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <HandHeart className="w-5 h-5 text-pink-400" />
          <h2 className="font-semibold text-pink-300">Good Deeds Board</h2>
        </div>
        {stats && <StreakBadge stats={stats} />}
      </div>

      <p className="text-xs text-slate-500">
        Claim a deed to help someone nearby. You earn <strong className="text-amber-400">+10 points</strong> when
        you mark it complete — not when you claim.
      </p>

      {message && (
        <p className="text-sm text-green-400 bg-green-950/30 border border-green-800/40 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <PostDeedForm latitude={latitude} longitude={longitude} onPosted={refresh} />

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-5">
          {helping.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-green-400 mb-2">
                You're helping ({helping.length})
              </h3>
              <div className="space-y-2">
                {helping.map((deed) => (
                  <DeedCard key={deed.id} deed={deed}>
                    <button
                      type="button"
                      onClick={() => complete(deed.id)}
                      disabled={actionId === deed.id}
                      className="btn-primary text-xs mt-2 py-1.5 px-3 flex items-center gap-1 bg-green-600 hover:bg-green-700"
                    >
                      {actionId === deed.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      Mark complete (+10 pts)
                    </button>
                  </DeedCard>
                ))}
              </div>
            </section>
          )}

          {posted.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-400 mb-2">
                Your requests ({posted.length})
              </h3>
              <div className="space-y-2">
                {posted.map((deed) => (
                  <DeedCard key={deed.id} deed={deed}>
                    {deed.status === "open" && (
                      <p className="text-xs text-slate-500 mt-2">Waiting for a volunteer…</p>
                    )}
                  </DeedCard>
                ))}
              </div>
            </section>
          )}

          {nearby.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-pink-400 mb-2">
                Help nearby ({nearby.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                {nearby.map((deed) => (
                  <DeedCard key={deed.id} deed={deed}>
                    <button
                      type="button"
                      onClick={() => claim(deed.id)}
                      disabled={actionId === deed.id}
                      className="btn-primary text-xs mt-2 py-1.5 px-3"
                    >
                      {actionId === deed.id ? "Claiming…" : "Claim — I'll help"}
                    </button>
                  </DeedCard>
                ))}
              </div>
            </section>
          )}

          {empty && (
            <p className="text-sm text-slate-500 py-2">
              No deeds yet — post a request or check back later.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
