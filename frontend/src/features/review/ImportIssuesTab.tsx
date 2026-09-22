import { useState } from "react";

import { type ImportIssueType, useImportIssues, useResolveImportIssue } from "../../api/review";
import { useAuth } from "../auth/useAuth";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";

const ISSUE_TYPES: ImportIssueType[] = [
  "LAYOUT_MISMATCH",
  "ORPHAN_FILL",
  "AMBIGUOUS_BOUNDARY",
  "UNLABELED_ROW_ENTRY",
  "UNATTACHED_NOTE",
  "CONFLICTING_VESSEL_LENGTH",
  "UNKNOWN_BERTH_LENGTH",
  "UNKNOWN_BERTH",
  "NAME_VARIANTS_MERGED",
  "HISTORICAL_OVERLAP",
];

export function ImportIssuesTab() {
  const { isAdmin } = useAuth();
  const [typeFilter, setTypeFilter] = useState<ImportIssueType | "">("");
  const [resolvedFilter, setResolvedFilter] = useState<"" | "true" | "false">("false");
  const { data: issues, isPending, isError, error } = useImportIssues({
    type: typeFilter || undefined,
    resolved: resolvedFilter === "" ? undefined : resolvedFilter === "true",
  });
  const resolveIssue = useResolveImportIssue();

  return (
    <div>
      <div className="mb-3 flex gap-3 text-sm">
        <select
          className="rounded-md border border-slate-300 px-2 py-1"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ImportIssueType | "")}
        >
          <option value="">All types</option>
          {ISSUE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-300 px-2 py-1"
          value={resolvedFilter}
          onChange={(e) => setResolvedFilter(e.target.value as "" | "true" | "false")}
        >
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
          <option value="">All</option>
        </select>
      </div>

      {isPending && <LoadingState label="Loading import issues…" />}
      {isError && <ErrorState error={error} />}
      {issues && issues.length === 0 && <EmptyState>No import issues match these filters.</EmptyState>}
      {issues && issues.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white text-sm">
          {issues.map((issue) => (
            <li key={issue.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                    {issue.issue_type}
                  </span>
                  {issue.message}
                  {issue.source_ref && (
                    <div className="mt-0.5 text-xs text-slate-400">Source: {issue.source_ref}</div>
                  )}
                  {issue.resolved_at && (
                    <div className="mt-0.5 text-xs text-emerald-700">
                      Resolved{issue.resolution_note ? `: ${issue.resolution_note}` : ""}
                    </div>
                  )}
                </div>
                {isAdmin && !issue.resolved_at && (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-blue-600 hover:underline"
                    onClick={() => {
                      const note = window.prompt("Resolution note (optional):") ?? undefined;
                      resolveIssue.mutate({ id: issue.id, note });
                    }}
                  >
                    Resolve
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
