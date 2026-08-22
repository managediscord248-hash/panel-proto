import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context";
import { useTheme } from "./theme-context";
import { Login } from "./pages/Login";
import { Setup } from "./pages/Setup";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Servers } from "./pages/Servers";
import { ServerDetail } from "./pages/ServerDetail";
import { Users } from "./pages/Users";
import { Settings } from "./pages/Settings";
import { AuditLog } from "./pages/AuditLog";
import { Nodes } from "./pages/Nodes";
import { FuturisticBackground } from "./components/FuturisticBackground";
import { StartupAnimation } from "./components/StartupAnimation";
import { useEffect, useState } from "react";
import { api } from "./api";

function ProtectedRoute({ children, requireOwner, requireAdmin }: { children: React.ReactNode; requireOwner?: boolean; requireAdmin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-az-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (requireOwner && user.role !== "owner") return <Navigate to="/" replace />;
  if (requireAdmin && user.role === "user") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const { user, loading } = useAuth();
  const { panelName } = useTheme();
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [startupAnimation, setStartupAnimation] = useState<boolean>(true);
  const [showStartup, setShowStartup] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.getSetupStatus().then((res) => setSetupComplete(res.setupComplete)).catch(() => setSetupComplete(true));
  }, []);

  useEffect(() => {
    if (setupComplete !== null) {
      api.getSettings().then((res) => {
        const enabled = res.settings.startup_animation !== "0";
        setStartupAnimation(enabled);
        if (enabled && setupComplete) {
          setShowStartup(true);
          setTimeout(() => setShowStartup(false), 3000);
        }
      }).catch(() => {});
    }
  }, [setupComplete]);

  if (loading || setupComplete === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-az-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500 text-sm">Loading {panelName}...</span>
        </div>
      </div>
    );
  }

  if (!setupComplete && !location.pathname.startsWith("/setup")) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <>
      {showStartup && startupAnimation && <StartupAnimation />}
      <Routes>
        <Route path="/setup" element={setupComplete ? <Navigate to="/" replace /> : <Setup />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="servers" element={<Servers />} />
          <Route path="servers/:id" element={<ServerDetail />} />
          <Route path="users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
          <Route path="nodes" element={<ProtectedRoute requireAdmin><Nodes /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute requireOwner><Settings /></ProtectedRoute>} />
          <Route path="audit" element={<ProtectedRoute requireAdmin><AuditLog /></ProtectedRoute>} />
        </Route>
      </Routes>
    </>
  );
}
