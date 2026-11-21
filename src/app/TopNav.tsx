import { useState } from "react";
import { NavLink } from "react-router-dom";
import { getToken } from "../auth/session";
import { useMe } from "../auth/useAuth";
import Avatar from "../components/Avatar";
import { Icon } from "../components/icons";
import NotificationBell from "../components/NotificationBell";
import { itemsFor, NavList, Wordmark } from "./Sidebar";
import { useQualityAvailable } from "../features/quality/useQuality";
import { useLogout } from "./useLogout";

/**
 * The top bar. On a desktop it only carries notifications, since the sidebar has the mark, the links and the account.
 * On phones and small tablets it also has the mark, the account and logout, and a menu button that opens the links.
 */
export default function TopNav() {
  const me = useMe();
  const quality = useQualityAvailable(me.data?.role === "admin");
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!getToken()) return null;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-page/95 px-4 backdrop-blur sm:px-6 lg:justify-end lg:px-8">
        <div className="flex items-center gap-3 lg:hidden">
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-md text-ink-600 ring-1 ring-inset ring-line"
          >
            <Icon name={menuOpen ? "close" : "menu"} size={20} />
          </button>
          <NavLink to="/" aria-label="Dashboard" className="text-brand-900">
            <Wordmark />
          </NavLink>
        </div>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <NavLink to="/account" aria-label="Your account" className="rounded-full lg:hidden">
            <Avatar size={32} />
          </NavLink>
          <button
            type="button"
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className="grid h-9 w-9 place-items-center rounded-md text-ink-600 transition-colors hover:bg-surface hover:text-ink-900 lg:hidden"
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 top-14 z-30 flex flex-col gap-0.5 overflow-auto bg-brand-900 p-3 lg:hidden">
          <NavList items={itemsFor(me.data?.role, { quality: quality.available })} onNavigate={() => setMenuOpen(false)} />
        </nav>
      )}
    </>
  );
}
