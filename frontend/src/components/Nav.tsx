import {
  Anchor,
  CalendarDays,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  LogOut,
  Sailboat,
  Search,
} from "lucide-react";
import type { ComponentType } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useLogout } from "../api/auth";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "./Button";

const LINK_CLASS =
  "transition-default flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-surface-800 hover:text-white aria-[current=page]:bg-brand-600/15 aria-[current=page]:text-brand-300";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  requiresAuth?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Schedule", icon: CalendarDays, end: true },
  { to: "/vessels", label: "Vessels", icon: Sailboat },
  { to: "/berths", label: "Berths", icon: Anchor },
  { to: "/availability", label: "Find a berth", icon: Search },
  { to: "/reports", label: "Reports", icon: LayoutDashboard },
  { to: "/review", label: "Data review", icon: ClipboardCheck, requiresAuth: true },
];

export function Nav() {
  const { user, isLoggedIn } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-surface-700 bg-surface-900/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 pr-2 text-slate-100">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient shadow-glow">
              <Compass className="text-white" size={18} />
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">
              Dock Scheduler
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Main">
            {NAV_ITEMS.filter((item) => !item.requiresAuth || isLoggedIn).map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={LINK_CLASS}>
                <item.icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
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
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
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
