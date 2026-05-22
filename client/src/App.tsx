import { Routes, Route, Navigate } from "react-router";
import { useAppSelector } from "./store/hooks";
import Auth from "./pages/auth/Auth";
import Dashboard from "./pages/dashboard/Dashboard";
import Graph from "./pages/Graph";
import Verdict from "./pages/verdict/Verdict";
import FlaggedAccounts from "./pages/flagged/FlaggedAccounts";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";

function App() {
  const token = useAppSelector((s) => s.auth.token);

  return (
    <Routes>
      {/* Root: send authenticated users to dashboard, others to auth */}
      <Route path="/" element={<Navigate to={token ? "/dashboard" : "/auth"} replace />} />

      {/* Public: redirect away if already logged in */}
      <Route
        path="/auth"
        element={token ? <Navigate to="/dashboard" replace /> : <Auth />}
      />

      {/* Protected: Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppShell>
              <Dashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Protected: Network Graph */}
      <Route
        path="/network-forensic"
        element={
          <ProtectedRoute>
            <AppShell>
              <Graph />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Protected: Standalone Verdict page */}
      <Route
        path="/verdict/:id"
        element={
          <ProtectedRoute>
            <AppShell>
              <Verdict />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Protected: Flagged Accounts */}
      <Route
        path="/flagged-accounts"
        element={
          <ProtectedRoute>
            <AppShell>
              <FlaggedAccounts />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Protected: History */}
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <AppShell>
              <History />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Protected: Analytics */}
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AppShell>
              <Analytics />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
