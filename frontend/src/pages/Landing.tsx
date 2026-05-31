import { Link } from "react-router-dom";
import {
  Bot,
  MapPin,
  Radio,
  Shield,
  Users,
  Zap,
  ArrowRight,
} from "lucide-react";
import CrisisRouteLogo, { BRAND, CrisisRouteLogoStacked } from "../components/CrisisRouteLogo";

const FEATURES = [
  {
    icon: Bot,
    title: "AI Agent Dispatch",
    description:
      "Gemini triages aid requests, matches volunteers by skill and proximity, and assigns missions in seconds.",
  },
  {
    icon: MapPin,
    title: "Safe Route Planning",
    description:
      "Driving routes automatically avoid danger zones so volunteers reach survivors without entering harm's way.",
  },
  {
    icon: Radio,
    title: "Instant Alerts",
    description:
      "Push notifications and SMS briefings keep volunteers informed the moment they're assigned.",
  },
  {
    icon: Users,
    title: "Command Center",
    description:
      "Coordinators see live incidents, volunteer status, and agent decisions on one unified dashboard.",
  },
];

const STEPS = [
  { step: "1", label: "Disaster detected", detail: "Live feeds surface incidents and aid requests" },
  { step: "2", label: "Agent deploys", detail: "AI matches the right people to the right places" },
  { step: "3", label: "Volunteers mobilize", detail: "Briefings, routes, and alerts — all in one app" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="hover:opacity-90 transition-opacity shrink-0">
            <CrisisRouteLogo size={40} />
          </Link>
          <Link
            to="/login"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-20 sm:pt-14 sm:pb-28 text-center">
          {/* Hero logo — icon + Crisis (red) + Route (white) */}
          <CrisisRouteLogoStacked size={96} className="mb-12 mx-auto" />

          <div className="inline-flex items-center gap-2 bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <Zap className="w-3.5 h-3.5" style={{ color: BRAND.red }} />
            From incident to dispatch in under 60 seconds
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
            Coordinate disaster response{" "}
            <span className="text-red-500" style={{ color: BRAND.red }}>before chaos wins</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            <span style={{ color: BRAND.red, fontWeight: 600 }}>Crisis</span>
            <span className="text-slate-200 font-semibold">Route</span> is an AI-powered platform that connects volunteers to
            life-saving missions — with smart routing, real-time alerts, and a
            coordinator command center built for emergencies.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-base w-full sm:w-auto justify-center"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#how-it-works"
              className="btn-secondary inline-flex items-center gap-2 px-8 py-3.5 text-base w-full sm:w-auto justify-center"
            >
              See how it works
            </a>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-red-400">60s</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Agent dispatch</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-red-400">24/7</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Live monitoring</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-red-400">1 tap</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Mission accept</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Built for the critical hour</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            When disasters strike, the failure isn't lack of volunteers — it's
            coordination. CrisisRoute fixes that.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="card hover:border-slate-600 transition-colors group"
            >
              <div className="w-11 h-11 bg-red-600/15 rounded-lg flex items-center justify-center mb-4 group-hover:bg-red-600/25 transition-colors">
                <Icon className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-slate-800 bg-slate-800/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">How it works</h2>
            <p className="text-slate-400">Three steps from crisis to coordinated response</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map(({ step, label, detail }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                  {step}
                </div>
                <h3 className="font-semibold mb-2">{label}</h3>
                <p className="text-sm text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="card border-blue-800/30 bg-blue-950/10">
            <Shield className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="font-semibold text-lg mb-2">For Volunteers</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Receive mission briefings, accept assignments, follow safe routes on
              the map, and report when you arrive on site — all from your phone.
            </p>
          </div>
          <div className="card border-amber-800/30 bg-amber-950/10">
            <Radio className="w-8 h-8 text-amber-400 mb-4" />
            <h3 className="font-semibold text-lg mb-2">For Coordinators</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Monitor live disasters, deploy the AI agent with one click, track
              volunteer missions, and review agent decision logs in real time.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <CrisisRouteLogoStacked size={56} className="mb-8 mx-auto opacity-90" />
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to respond?</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Sign in with Google to access volunteer missions and the coordinator
            command center — same account, both views.
          </p>
          <Link
            to="/login"
            className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-base"
          >
            Get Started
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <CrisisRouteLogo size={28} className="opacity-80" />
          <p>Powered by Gemini · Google Maps · Firebase</p>
        </div>
      </footer>
    </div>
  );
}
