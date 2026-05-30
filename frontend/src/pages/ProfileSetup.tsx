import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useNotifications } from "../hooks/useNotifications";
import { useAuth } from "../hooks/useAuth";
import { Loader2 } from "lucide-react";

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

export default function ProfileSetup() {
  const { role } = useAuth();
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [preferredLang, setPreferredLang] = useState("en");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const { saveFcmToken } = useNotifications();

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

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    setStatusMsg("Getting your location...");

    // Get location with a 5-second timeout — don't block forever
    let latitude = 0;
    let longitude = 0;
    try {
      const pos = await Promise.race([
        new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 60000,
          })
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 5000)
        ),
      ]);
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch {
      // Location unavailable — use default (Istanbul for demo)
      latitude = 41.015;
      longitude = 28.975;
    }

    setStatusMsg("Saving profile...");

    try {
      const savePromise = setDoc(doc(db, "volunteers", user.uid), {
        uid: user.uid,
        display_name: user.displayName || "",
        email: user.email || "",
        phone: "",
        skills,
        languages,
        preferred_language: preferredLang,
        latitude,
        longitude,
        availability: true,
        status: "idle",
        fcm_token: "",
      });

      // Timeout after 10 seconds
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firestore write timed out. Check your internet connection and Firestore database setup.")), 10000)
      );

      await Promise.race([savePromise, timeoutPromise]);

      setStatusMsg("Enabling notifications...");
      await saveFcmToken(user.uid);

      setStatusMsg("Done!");
      setTimeout(() => {
        window.location.href = role === "coordinator" ? "/coordinator" : "/volunteer";
      }, 300);
    } catch (e: any) {
      console.error("Profile save error:", e);
      setStatusMsg("");
      setSaving(false);
      setError(e.message || "Failed to save profile. Check browser console for details.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Set Up Your Profile</h1>
      <p className="text-slate-400 mb-8">
        Tell us your skills and preferences so we can match you to the right
        missions.
      </p>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Your Skills</h2>
        <p className="text-sm text-slate-500 mb-3">Select at least one skill</p>
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
        <h2 className="text-lg font-semibold mb-4">Languages You Speak</h2>
        <div className="flex flex-wrap gap-2">
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

        <div className="mt-4">
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
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving || skills.length === 0}
        className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {statusMsg || "Saving..."}
          </>
        ) : (
          "Complete Setup"
        )}
      </button>

      {error && (
        <p className="text-red-400 text-sm mt-4 bg-red-950/30 rounded-lg p-3">
          {error}
        </p>
      )}

      {skills.length === 0 && (
        <p className="text-xs text-slate-500 text-center mt-3">
          Select at least one skill above to continue
        </p>
      )}
    </div>
  );
}
