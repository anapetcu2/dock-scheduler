import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useOrganizations } from "../../api/organizations";
import { useVessels } from "../../api/vessels";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { formatDisplayDate } from "../../lib/dates";

type Tab = "active" | "historical";

export function VesselListPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const searching = query.trim() !== "";

  const { data: allVessels, isPending, isError, error } = useVessels({
    q: searching ? query : undefined,
  });

  // Split purely on whether the length is known — a vessel without one
  // can't actually be booked (VESSEL_LENGTH_UNKNOWN blocks it), so it
  // belongs with the rest of the data that needs attention before it's
  // usable, regardless of how recently it was last booked historically.
  const activeVessels = useMemo(() => (allVessels ?? []).filter((v) => v.loa_ft != null), [allVessels]);
  const historicalVessels = useMemo(() => (allVessels ?? []).filter((v) => v.loa_ft == null), [allVessels]);

  const { data: organizations } = useOrganizations();
  const orgName = (id: number | null) => organizations?.find((o) => o.id === id)?.name ?? "—";

  const vessels = searching ? allVessels : tab === "active" ? activeVessels : historicalVessels;

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

      {!searching && (
        <div className="mb-4 flex gap-1 border-b border-slate-200">
          <TabButton active={tab === "active"} onClick={() => setTab("active")}>
            Active ({activeVessels.length})
          </TabButton>
          <TabButton active={tab === "historical"} onClick={() => setTab("historical")}>
            Historical, needs length ({historicalVessels.length})
          </TabButton>
        </div>
      )}

      {isPending && <LoadingState label="Loading vessels…" />}
      {isError && <ErrorState error={error} />}
      {vessels && vessels.length === 0 && (
        <EmptyState>
          {tab === "historical" && !searching
            ? "No historical vessels found."
            : "No vessels found."}
        </EmptyState>
      )}
      {vessels && vessels.length > 0 && (
        <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">LOA</th>
              <th className="px-3 py-2">Draft</th>
              <th className="px-3 py-2">Organization</th>
              <th className="px-3 py-2">Last booked</th>
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
                <td className="px-3 py-2 text-slate-500">
                  {v.last_booked_date ? formatDisplayDate(v.last_booked_date) : "Never"}
                </td>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium ${
        active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
