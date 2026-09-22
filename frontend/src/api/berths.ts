import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components, operations } from "./schema";

export type Berth = components["schemas"]["BerthRead"];
export type BerthCreateInput = operations["create_berth"]["requestBody"]["content"]["application/json"];
export type BerthUpdateInput = operations["update_berth"]["requestBody"]["content"]["application/json"];

export function useBerths(includeInactive = false) {
  return useQuery({
    queryKey: ["berths", { includeInactive }],
    queryFn: async () =>
      unwrap<Berth[]>(
        await api.GET("/api/berths", { params: { query: { include_inactive: includeInactive } } }),
      ),
  });
}

export function useCreateBerth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BerthCreateInput) =>
      unwrap<Berth>(await api.POST("/api/berths", { body: input })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["berths"] }),
  });
}

export function useUpdateBerth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: BerthUpdateInput }) =>
      unwrap<Berth>(
        await api.PATCH("/api/berths/{berth_id}", {
          params: { path: { berth_id: id } },
          body: input,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["berths"] }),
  });
}
