import { useState } from "react";
import { HandHeart, Loader2 } from "lucide-react";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";

const CATEGORIES = [
  { id: "errand", label: "Errand" },
  { id: "groceries", label: "Groceries" },
  { id: "transport", label: "Ride / transport" },
  { id: "check_in", label: "Wellness check-in" },
  { id: "other", label: "Other" },
];

interface PostDeedFormProps {
  latitude: number;
  longitude: number;
  onPosted?: () => void;
}

export default function PostDeedForm({ latitude, longitude, onPosted }: PostDeedFormProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("errand");
  const [timeWindow, setTimeWindow] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const user = auth.currentUser;
    if (!user || !description.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      await api.goodDeeds.post({
        posted_by: user.uid,
        description: description.trim(),
        latitude,
        longitude,
        category,
        time_window: timeWindow.trim(),
      });
      setDescription("");
      setTimeWindow("");
      setOpen(false);
      onPosted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not post deed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-sm flex items-center gap-2"
      >
        <HandHeart className="w-4 h-4" />
        Post a good deed
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <HandHeart className="w-4 h-4 text-pink-400" />
        Ask the community for help
      </h4>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
      >
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What do you need help with?"
        rows={3}
        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
      />
      <input
        value={timeWindow}
        onChange={(e) => setTimeWindow(e.target.value)}
        placeholder="When? e.g. today before 5pm"
        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !description.trim()}
          className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
        </button>
      </div>
    </div>
  );
}
