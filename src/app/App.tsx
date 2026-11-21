import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { getToken } from "../auth/session";
import { useMe } from "../auth/useAuth";
import type { Role } from "../api/schemas";
import Sidebar from "./Sidebar";
import { LoadingBlock } from "../components/ui";
import TopNav from "./TopNav";
import Live from "./Live";
import LoginPage from "../features/login/LoginPage";
import Dashboard from "../features/dashboard/Dashboard";
import AlertQueue from "../features/alerts/AlertQueue";
import CaseDetail from "../features/cases/CaseDetail";
import CasesList from "../features/cases/CasesList";
import AccountPage from "../features/account/AccountPage";
import NotificationsPage from "../features/notifications/NotificationsPage";
import ObservabilityPage from "../features/observability/ObservabilityPage";
import CompliancePage from "../features/compliance/CompliancePage";
import QualityPage from "../features/quality/QualityPage";
import { useQualityAvailable } from "../features/quality/useQuality";

function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation();
  if (!getToken()) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

/** Shows the page only to the listed roles. The backend enforces the same rule on every call. */
function RequireRole({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const me = useMe();
  if (me.isPending) return <LoadingBlock label="Loading…" rows={2} />;
  if (me.isError || !me.data) return <Navigate to="/login" replace />;
  if (!roles.includes(me.data.role as Role)) {
    return <p role="alert" className="text-danger-600">This page is not available for your role.</p>;
  }
  return children;
}

/** The Quality page disappears if the backend has no /api/quality: its route sends the user back to the dashboard. */
function QualityGate({ children }: { children: JSX.Element }) {
  const { available, pending } = useQualityAvailable(true);
  if (pending) return <LoadingBlock label="Loading…" rows={2} />;
  return available ? children : <Navigate to="/" replace />;
}
/** The signed-in app: top bar, floating sidebar, live updates, and the pages. */
function Shell() {
  return (
    // lg:pl-60 clears the fixed sidebar (w-60).
    <div className="min-h-screen lg:pl-60">
      <Sidebar />
      <TopNav />
      <Live />
      <main className="mx-auto max-w-[84rem] px-4 py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/alerts" element={<RequireAuth><RequireRole roles={["admin"]}><AlertQueue /></RequireRole></RequireAuth>} />
          <Route path="/cases" element={<RequireAuth><CasesList /></RequireAuth>} />
          <Route path="/cases/:caseId" element={<RequireAuth><CaseDetail /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="/admin/observability" element={<RequireAuth><RequireRole roles={["admin"]}><ObservabilityPage /></RequireRole></RequireAuth>} />
          <Route path="/compliance" element={<RequireAuth><CompliancePage /></RequireAuth>} />
          <Route path="/quality" element={<RequireAuth><RequireRole roles={["admin"]}><QualityGate><QualityPage /></QualityGate></RequireRole></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  // The auth pages render alone: no top bar, no sidebar, and no main padding, so they fit the viewport.
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Shell />} />
    </Routes>
  );
}
