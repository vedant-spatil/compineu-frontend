import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { getToken } from "../auth/session";
import { useMe } from "../auth/useAuth";
import Avatar from "../components/Avatar";
import { Icon } from "../components/icons";
import { useQualityAvailable } from "../features/quality/useQuality";
import { useLogout } from "./useLogout";

export type Item = { to: string; label: string; icon: ReactNode };

const ICONS = {
  dashboard: <Icon name="dashboard" />,
  alerts: <Icon name="alert" />,
  cases: <Icon name="list" />,
  compliance: <Icon name="shield" />,
  quality: <Icon name="bars" />,
  observability: <Icon name="chart" />,
};

/** The navigation items for a role. Admin sees the alert queue and observability; QA sees only their own incidents. */
export function itemsFor(role: string | undefined, features: { quality?: boolean } = {}): Item[] {
  const items: Item[] = [{ to: "/", label: "Dashboard", icon: ICONS.dashboard }];
  if (role === "admin") items.push({ to: "/alerts", label: "Alerts", icon: ICONS.alerts });
  items.push({ to: "/cases", label: role === "qa" ? "My incidents" : "Incidents", icon: ICONS.cases });
  // Import and Projects are hidden for compineu. Their pages and sources stay in the repo so this can be reverted.
  items.push({ to: "/compliance", label: "Compliance", icon: ICONS.compliance });
  // Quality is listed only when the backend has /api/quality.
  if (role === "admin" && features.quality) items.push({ to: "/quality", label: "Quality", icon: ICONS.quality });
  if (role === "admin") items.push({ to: "/admin/observability", label: "Observability", icon: ICONS.observability });
  return items;
}

// On the navy rail: quiet links, and the current page gets a lighter fill with an amber edge.
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors ${
    isActive
      ? "bg-brand-700 font-medium text-white shadow-[inset_3px_0_0_var(--color-warn-400)]"
      : "text-brand-100/85 hover:bg-brand-800 hover:text-white"
  }`;

/** The links, each with its icon and label. `showLabels` is kept for older callers; labels always show now. */
export function NavList({ items, onNavigate }: { items: Item[]; onNavigate?: () => void; showLabels?: boolean }) {
  return (
    <>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass} onClick={onNavigate}>
          {item.icon}
          <span className="whitespace-nowrap">{item.label}</span>
        </NavLink>
      ))}
    </>
  );
}

/** The product mark: a shield and the name. Used in the sidebar, the phone top bar and the sign-in page. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-wordmark text-[1.0625rem] font-semibold tracking-tight ${className}`}>
      <Icon name="shield" size={20} className="text-warn-400" />
      compineu
    </span>
  );
}

/**
 * The desktop navigation: a full-height navy rail with labelled links, and the signed-in user at the bottom.
 * Phones and small tablets use the menu in the top bar instead.
 */
export default function Sidebar() {
  const me = useMe();
  const quality = useQualityAvailable(me.data?.role === "admin");
  const logout = useLogout();
  if (!getToken()) return null;
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-brand-900 lg:flex">
      <NavLink to="/" aria-label="Dashboard" className="flex h-14 items-center px-5 text-white">
        <Wordmark />
      </NavLink>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
        <NavList items={itemsFor(me.data?.role, { quality: quality.available })} />
      </nav>
      <div className="flex items-center gap-2 border-t border-brand-800 p-3">
        <NavLink
          to="/account"
          aria-label="Your account"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-brand-800"
        >
          <Avatar size={30} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">{me.data?.email ?? "Account"}</span>
            <span className="block text-xs capitalize text-brand-100/70">{me.data?.role === "qa" ? "Reviewer" : me.data?.role ?? ""}</span>
          </span>
        </NavLink>
        <button
          type="button"
          onClick={logout}
          aria-label="Log out"
          title="Log out"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-brand-100/85 transition-colors hover:bg-brand-800 hover:text-white"
        >
          <Icon name="logout" />
        </button>
      </div>
    </aside>
  );
}
