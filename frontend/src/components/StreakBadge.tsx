import { Flame, Star } from "lucide-react";
import type { VolunteerStats } from "../types";

interface StreakBadgeProps {
  stats: VolunteerStats;
}

export default function StreakBadge({ stats }: StreakBadgeProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/40 border border-amber-800/40 text-amber-300">
        <Flame className="w-3.5 h-3.5" />
        {stats.current_streak} day streak
      </span>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/40 border border-blue-800/40 text-blue-300">
        <Star className="w-3.5 h-3.5" />
        {stats.total_points} pts
      </span>
      <span className="text-slate-500 text-xs">
        {stats.deeds_completed} deeds · best {stats.longest_streak} days
      </span>
    </div>
  );
}
