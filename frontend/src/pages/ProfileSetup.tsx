import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { api } from "../lib/api";
import { isValidE164, normalizePhone } from "../lib/phone";
import { useNotifications } from "../hooks/useNotifications";
import { Loader2, Phone, MessageSquare } from "lucide-react";

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
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [preferredLang, setPreferredLang] = useState("en");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
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

    setPhoneError("");
    const normalizedPhone = normalizePhone(phone);
    if (phone.trim() && !isValidE164(normalizedPhone)) {
      setPhoneError("Enter a valid number in international format, e.g. +905551234567");
      return;
    }

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
        phone: normalizedPhone,
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

      if (normalizedPhone) {
        setStatusMsg("Sending welcome SMS...");
        try {
          await api.alerts.sendWelcome(user.uid);
        } catch {
          // Non-blocking — Twilio may be unconfigured in dev
        }
      }

      setStatusMsg("Done!");
      setTimeout(() => {
        window.location.href = "/volunteer";
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

      <div className="card mb-6 border-slate-600/50">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold">SMS Alerts</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Add your personal mobile number to receive mission briefings by text when push
          notifications aren't available. Use international format with country code — not a
          Twilio or business line.
        </p>
        <label className="text-sm text-slate-400 block mb-2" htmlFor="phone">
          Mobile number <span className="text-slate-600">(optional)</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError("");
            }}
            placeholder="+1 555 123 4567"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
            autoComplete="tel"
          />
        </div>
        {phoneError && (
          <p className="text-red-400 text-xs mt-2">{phoneError}</p>
        )}
        <p className="text-xs text-slate-600 mt-2">
          Example: +33612345678 (France), +905551234567 (Turkey), +14155552671 (US)
        </p>
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
