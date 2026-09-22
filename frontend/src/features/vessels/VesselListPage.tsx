import { useState } from "react";
import { Link } from "react-router-dom";

import { useOrganizations } from "../../api/organizations";
import { useVessels } from "../../api/vessels";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";

export function VesselListPage() {
  const [query, setQuery] = useState("");
  const { data: vessels, isPending, isError, error } = useVessels({ q: query || undefined });
  const { data: organizations } = useOrganizations();
  const orgName = (id: number | null) => organizations?.find((o) => o.id === id)?.name ?? "—";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Vessels</h1>
        <input
          type="search"
          placeholder={"Search vessels…"}
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isPending && <LoadingState label="Loading vessels…" />}
      {isError && <ErrorState error={error} />}
      {vessels && vessels.length === 0 && <EmptyState>No vessels found.</EmptyState>}
      {vessels && vessels.length > 0 && (
        <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">LOA</th>
              <th className="px-3 py-2">Draft</th>
              <th className="px-3 py-2">Organization</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {vessels.map((v) => (
              <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">
                  <Link to={`/vessels/${v.id}`} className="hover:text-blue-700">
                    {v.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{v.type_prefix ?? "—"}</td>
                <td className="px-3 py-2">
                  {v.loa_ft ?? <span className="text-amber-600">Unknown</span>}
                </td>
                <td className="px-3 py-2">{v.draft_ft ?? "—"}</td>
                <td className="px-3 py-2">{orgName(v.organization_id)}</td>
                <td className="px-3 py-2 text-right">
                  {v.loa_ft == null && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Needs length
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
