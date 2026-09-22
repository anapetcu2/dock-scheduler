import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../features/auth/useAuth";
import { LoadingState } from "./LoadingState";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingState />;
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}
