import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api, unwrap } from "./client";
import type { components, operations } from "./schema";

export type Vessel = components["schemas"]["VesselRead"];
export type VesselDetail = components["schemas"]["VesselDetail"];
export type VesselCreateInput = operations["create_vessel"]["requestBody"]["content"]["application/json"];
export type VesselUpdateInput = operations["update_vessel"]["requestBody"]["content"]["application/json"];

/** The 409 body for a duplicate vessel: `{message, vessel_id}`, wrapped in
 * FastAPI's HTTPException `detail`. See DECISIONS.md, Phase 2. */
export interface VesselConflictDetail {
  message: string;
  vessel_id: number;
}

export function isVesselConflictDetail(detail: unknown): detail is VesselConflictDetail {
  return (
    typeof detail === "object" &&
    detail !== null &&
    "vessel_id" in detail &&
    typeof (detail as VesselConflictDetail).vessel_id === "number"
  );
}

export interface VesselListQuery {
  q?: string;
  includeInactive?: boolean;
  /** "Recent" means within this many years of today, OR within this many
   * years of the most recent booking in the whole dataset, whichever
   * cutoff is earlier — computed server-side (app/api/vessels.py) so a
   * historical import's own tail end still counts as recent even once
   * the app is running years past the import's date range. */
  recentYears?: number;
  historical?: boolean;
}

export function useVessels(query: VesselListQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["vessels", query],
    enabled: options.enabled,
    queryFn: async () =>
      unwrap<Vessel[]>(
        await api.GET("/api/vessels", {
          params: {
            query: {
              q: query.q,
              include_inactive: query.includeInactive,
              recent_years: query.recentYears,
              historical: query.historical,
            },
          },
        }),
      ),
  });
}

export function useVessel(vesselId: number | undefined) {
  return useQuery({
    queryKey: ["vessels", "detail", vesselId],
    enabled: vesselId !== undefined,
    queryFn: async () =>
      unwrap<VesselDetail>(
        await api.GET("/api/vessels/{vessel_id}", {
          params: { path: { vessel_id: vesselId as number } },
        }),
      ),
  });
}

function useInvalidateVessels() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["vessels"] });
}

export function useCreateVessel() {
  const invalidate = useInvalidateVessels();
  return useMutation({
    mutationFn: async (input: VesselCreateInput) => {
      const { data, error, response } = await api.POST("/api/vessels", { body: input });
      if (error !== undefined) {
        throw new ApiError(response.status, error);
      }
      return data as Vessel;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateVessel() {
  const invalidate = useInvalidateVessels();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: VesselUpdateInput }) =>
      unwrap<Vessel>(
        await api.PATCH("/api/vessels/{vessel_id}", {
          params: { path: { vessel_id: id } },
          body: input,
        }),
      ),
    onSuccess: invalidate,
  });
}
