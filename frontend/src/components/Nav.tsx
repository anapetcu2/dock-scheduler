import { NavLink, useNavigate } from "react-router-dom";

import { useLogout } from "../api/auth";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "./Button";

const LINK_CLASS =
  "px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 aria-[current=page]:text-blue-700 aria-[current=page]:bg-blue-50";

export function Nav() {
  const { user, isLoggedIn } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
        <nav className="flex flex-wrap items-center gap-1" aria-label="Main">
          <NavLink to="/" end className={LINK_CLASS}>
            Schedule
          </NavLink>
          <NavLink to="/vessels" className={LINK_CLASS}>
            Vessels
          </NavLink>
          <NavLink to="/berths" className={LINK_CLASS}>
            Berths
          </NavLink>
        </nav>
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <span className="text-sm text-slate-600">
                {user?.name} <span className="text-slate-400">({user?.role})</span>
              </span>
              <Button
                variant="ghost"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
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
