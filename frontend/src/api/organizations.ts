import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Organization = components["schemas"]["OrganizationRead"];

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async () => unwrap<Organization[]>(await api.GET("/api/organizations")),
  });
}
