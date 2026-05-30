import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  AlertTriangle,
  MapPin,
  LogOut,
  Radio,
} from "lucide-react";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut, role } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: "/volunteer", label: "My Missions", icon: MapPin, roles: ["volunteer", "coordinator"] as const },
    { path: "/coordinator", label: "Command Center", icon: Radio, roles: ["coordinator"] as const },
  ].filter((item) => item.roles.includes(role));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to={role === "coordinator" ? "/coordinator" : "/volunteer"} className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <span className="text-lg font-bold">CrisisRoute</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? "bg-slate-700 text-red-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors truncate max-w-[140px] sm:max-w-[200px]"
              title="View profile"
            >
              {user?.displayName}
            </Link>
            <button
              onClick={signOut}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
