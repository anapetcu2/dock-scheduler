import { useMe } from "../../api/auth";

export function useAuth() {
  const { data: user, isPending } = useMe();
  return {
    user: user ?? null,
    isLoggedIn: user != null,
    isAdmin: user?.role === "admin",
    isLoading: isPending,
  };
}
