import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type IntegrityIssue = components["schemas"]["IntegrityIssueRead"];
export type ImportIssue = components["schemas"]["ImportIssueRead"];
export type ImportIssueType = components["schemas"]["ImportIssueType"];
export type ReviewSummary = components["schemas"]["ReviewSummary"];

export function useIntegrityIssues() {
  return useQuery({
    queryKey: ["review", "integrity"],
    queryFn: async () => unwrap<IntegrityIssue[]>(await api.GET("/api/review/integrity")),
  });
}

export function useImportIssues(filters: { type?: ImportIssueType; resolved?: boolean } = {}) {
  return useQuery({
    queryKey: ["review", "import-issues", filters],
    queryFn: async () =>
      unwrap<ImportIssue[]>(
        await api.GET("/api/review/import-issues", {
          params: { query: { type: filters.type, resolved: filters.resolved } },
        }),
      ),
  });
}

export function useReviewSummary() {
  return useQuery({
    queryKey: ["review", "summary"],
    queryFn: async () => unwrap<ReviewSummary>(await api.GET("/api/review/summary")),
  });
}

export function useResolveImportIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: number; note?: string }) =>
      unwrap<ImportIssue>(
        await api.POST("/api/review/import-issues/{issue_id}/resolve", {
          params: { path: { issue_id: id } },
          body: { note: note ?? null },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["review"] }),
  });
}
