import { Link, NavLink, useNavigate } from "react-router-dom";

import { useLogout } from "../api/auth";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "./Button";

const LINK_CLASS =
  "transition-default rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-surface-800 hover:text-slate-900 aria-[current=page]:bg-brand-600/15 aria-[current=page]:text-brand-300";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  requiresAuth?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Schedule", end: true },
  { to: "/vessels", label: "Vessels" },
  { to: "/berths", label: "Berths" },
  { to: "/availability", label: "Find a berth" },
  { to: "/reports", label: "Reports" },
  { to: "/review", label: "Data review", requiresAuth: true },
];

export function Nav() {
  const { user, isLoggedIn } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-surface-700 bg-surface-900/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <Link
            to="/welcome"
            className="transition-default rounded-lg pr-2 text-slate-900 hover:opacity-80"
          >
            <span className="hidden font-sans text-sm font-semibold tracking-tight sm:inline">
              Dock Scheduler
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Main">
            {NAV_ITEMS.filter((item) => !item.requiresAuth || isLoggedIn).map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={LINK_CLASS}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <span className="hidden text-sm text-slate-400 sm:inline">
                {user?.name}{" "}
                <span className="rounded-full bg-surface-800 px-2 py-0.5 text-xs text-slate-400">
                  {user?.role}
                </span>
              </span>
              <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
                Log out
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => navigate("/login")}>
              Log in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
