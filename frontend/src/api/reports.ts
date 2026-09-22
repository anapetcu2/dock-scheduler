import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type UtilizationRow = components["schemas"]["UtilizationRow"];

export function useUtilization(yearFrom: number, yearTo: number) {
  return useQuery({
    queryKey: ["reports", "utilization", yearFrom, yearTo],
    queryFn: async () =>
      unwrap<UtilizationRow[]>(
        await api.GET("/api/reports/utilization", {
          params: { query: { year_from: yearFrom, year_to: yearTo } },
        }),
      ),
  });
}
