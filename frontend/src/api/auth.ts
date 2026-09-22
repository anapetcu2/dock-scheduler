import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api, unwrap } from "./client";
import type { components, operations } from "./schema";

export type User = components["schemas"]["UserRead"];
export type LoginInput = operations["login"]["requestBody"]["content"]["application/json"];

export const meKey = ["auth", "me"] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/api/auth/me");
      const status: number = response.status;
      if (status === 401) {
        return null;
      }
      if (error !== undefined) {
        throw new ApiError(status, error);
      }
      return data as User;
    },
    // A 401 is an expected "logged out" result here, not a transient failure.
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => unwrap<User>(await api.POST("/api/auth/login", { body: input })),
    onSuccess: (user) => {
      queryClient.setQueryData(meKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.POST("/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(meKey, null);
      queryClient.invalidateQueries();
    },
  });
}
