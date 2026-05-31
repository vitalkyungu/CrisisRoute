import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import VolunteerDashboard from "./pages/VolunteerDashboard";
import CoordinatorDashboard from "./pages/CoordinatorDashboard";
import ProfileSetup from "./pages/ProfileSetup";
import Profile from "./pages/Profile";
import Layout from "./components/Layout";
import { CrisisRouteLogoStacked } from "./components/CrisisRouteLogo";

export default function App() {
  const { user, loading, hasProfile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-pulse flex flex-col items-center gap-6">
          <CrisisRouteLogoStacked size={72} />
          <p className="text-slate-400 text-sm">Loading CrisisRoute...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (!hasProfile) {
    return (
      <Layout>
        <Routes>
          <Route path="*" element={<ProfileSetup />} />
        </Routes>
      </Layout>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/setup" element={<ProfileSetup />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/volunteer" element={<VolunteerDashboard />} />
        <Route path="/coordinator" element={<CoordinatorDashboard />} />
        <Route path="*" element={<Navigate to="/volunteer" replace />} />
      </Routes>
    </Layout>
  );
}
