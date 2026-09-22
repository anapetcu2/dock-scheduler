import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type BerthAvailability = components["schemas"]["BerthAvailability"];

export interface AvailabilityQuery {
  start: string;
  end: string;
  vesselId?: number;
  loaFt?: number;
}

export function useAvailability(query: AvailabilityQuery | null) {
  return useQuery({
    queryKey: ["availability", query],
    enabled: query !== null,
    queryFn: async () =>
      unwrap<BerthAvailability[]>(
        await api.GET("/api/availability", {
          params: {
            query: {
              start: query!.start,
              end: query!.end,
              vessel_id: query!.vesselId,
              loa_ft: query!.loaFt,
            },
          },
        }),
      ),
  });
}
