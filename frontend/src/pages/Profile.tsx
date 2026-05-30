import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { deleteUser, reauthenticateWithPopup } from "firebase/auth";
import { auth, db, googleProvider } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import type { Volunteer } from "../types";
import { useNotifications } from "../hooks/useNotifications";
import { Loader2, Trash2, User, Mail, Globe, MapPin, ArrowLeft } from "lucide-react";

const SKILL_OPTIONS = [
  "medical",
  "search_rescue",
  "firefighting",
  "logistics",
  "translation",
  "counseling",
  "engineering",
  "communication",
  "driving",
  "first_aid",
  "water_rescue",
  "shelter_management",
];

const LANGUAGE_OPTIONS = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "ar", name: "Arabic" },
  { code: "es", name: "Spanish" },
  { code: "tr", name: "Turkish" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "zh", name: "Chinese" },
];

export default function Profile() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Volunteer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [preferredLang, setPreferredLang] = useState("en");
  const [availability, setAvailability] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const snap = await getDoc(doc(db, "volunteers", currentUser.uid));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Volunteer;
          setProfile(data);
          setSkills(data.skills || []);
          setLanguages(data.languages || ["en"]);
          setPreferredLang(data.preferred_language || "en");
          setAvailability(data.availability ?? true);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleSave = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || skills.length === 0) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateDoc(doc(db, "volunteers", currentUser.uid), {
        skills,
        languages,
        preferred_language: preferredLang,
        availability,
      });
      setMessage("Profile updated");
    } catch (e: any) {
      setError(e.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || deleteConfirmText !== "DELETE") return;

    setDeleting(true);
    setError("");

    try {
      await reauthenticateWithPopup(currentUser, googleProvider);
      await deleteDoc(doc(db, "volunteers", currentUser.uid));
      await deleteUser(currentUser);
    } catch (e: any) {
      setDeleting(false);
      if (e.code === "auth/requires-recent-login") {
        setError("Please sign out, sign back in, and try again to confirm deletion.");
      } else {
        setError(e.message || "Failed to delete account");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/volunteer"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <h1 className="text-2xl font-bold mb-2">Your Profile</h1>
      <p className="text-slate-400 mb-8 text-sm">
        Manage your volunteer info, availability, and account settings.
      </p>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-slate-300">{user?.displayName || "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-slate-300">{user?.email || "—"}</span>
          </div>
          {profile && (
            <>
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-slate-300 capitalize">{profile.status.replace("_", " ")}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-slate-300">
                  {profile.latitude.toFixed(3)}, {profile.longitude.toFixed(3)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Availability</h2>
          <button
            onClick={() => setAvailability((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              availability ? "bg-green-600" : "bg-slate-600"
            }`}
            aria-label="Toggle availability"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                availability ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
        <p className="text-sm text-slate-400">
          {availability
            ? "You are available for new mission assignments."
            : "You are marked unavailable and won't receive new missions."}
        </p>
      </div>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Skills</h2>
        <div className="flex flex-wrap gap-2">
          {SKILL_OPTIONS.map((skill) => (
            <button
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                skills.includes(skill)
                  ? "bg-red-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {skill.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Languages</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang.code}
              onClick={() => toggleLanguage(lang.code)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                languages.includes(lang.code)
                  ? "bg-red-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
        <label className="text-sm text-slate-400 block mb-2">
          Preferred language for mission briefings
        </label>
        <select
          value={preferredLang}
          onChange={(e) => setPreferredLang(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm w-full"
        >
          {LANGUAGE_OPTIONS.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || skills.length === 0}
        className="btn-primary w-full py-3 mb-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Changes"
        )}
      </button>

      {message && (
        <p className="text-green-400 text-sm mb-4 bg-green-950/30 rounded-lg p-3">{message}</p>
      )}
      {error && (
        <p className="text-red-400 text-sm mb-4 bg-red-950/30 rounded-lg p-3">{error}</p>
      )}

      <div className="card border-red-900/50">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
        <p className="text-sm text-slate-400 mb-4">
          Permanently delete your account and volunteer profile. This cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 rounded-lg px-4 py-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete Account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Type <span className="font-mono text-red-400">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm w-full"
              placeholder="DELETE"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== "DELETE"}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" /> Confirm Delete
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  setError("");
                }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={signOut}
        className="mt-6 w-full text-sm text-slate-400 hover:text-slate-200 py-2 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
