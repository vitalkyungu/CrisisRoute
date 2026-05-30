import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import VolunteerDashboard from "./pages/VolunteerDashboard";
import CoordinatorDashboard from "./pages/CoordinatorDashboard";
import ProfileSetup from "./pages/ProfileSetup";
import Profile from "./pages/Profile";
import Layout from "./components/Layout";

export default function App() {
  const { user, loading, hasProfile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-red-600 rounded-full" />
          <p className="text-slate-400">Loading CrisisRoute...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
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
        <Route path="*" element={<Navigate to="/volunteer" />} />
      </Routes>
    </Layout>
  );
}
