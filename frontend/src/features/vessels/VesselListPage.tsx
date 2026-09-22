import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useOrganizations } from "../../api/organizations";
import { type Vessel, useVessels } from "../../api/vessels";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";

type Tab = "recent" | "historical";
const RECENT_YEARS = 2;

function isFullyKnown(v: Vessel): boolean {
  // Length is what actually matters for booking (a null loa_ft blocks a
  // vessel booking outright — VESSEL_LENGTH_UNKNOWN in booking_rules.py);
  // type_prefix is cosmetic and often left blank even for a perfectly
  // usable vessel, so it isn't required here.
  return v.loa_ft != null;
}

export function VesselListPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("recent");
  const searching = query.trim() !== "";

  // "Recent" is booked-in-the-last-N-years *and* has a known length — a
  // vessel missing one never shows there, however recently it was booked,
  // since a length-less vessel can't even be re-booked without fixing
  // that first. It still needs to be visible *somewhere*, so anything
  // that doesn't qualify as Recent falls through to Historical instead of
  // disappearing — Historical is "everything else," not "everything
  // booked long ago."
  const { data: candidates, isPending: recentPending, isError: recentError, error: recentErr } =
    useVessels({ recentYears: RECENT_YEARS, historical: false }, { enabled: !searching });
  const { data: allVessels, isPending: allPending, isError: allError, error: allErr } = useVessels(
    {},
    { enabled: !searching && tab === "historical" },
  );
  const { data: searchResults, isPending: searchPending, isError: searchError, error: searchErr } =
    useVessels({ q: query }, { enabled: searching });

  const recentVessels = useMemo(() => (candidates ?? []).filter(isFullyKnown), [candidates]);
  const historicalVessels = useMemo(() => {
    const recentIds = new Set(recentVessels.map((v) => v.id));
    return (allVessels ?? []).filter((v) => !recentIds.has(v.id));
  }, [allVessels, recentVessels]);

  const { data: organizations } = useOrganizations();
  const orgName = (id: number | null) => organizations?.find((o) => o.id === id)?.name ?? "—";

  const vessels = searching ? searchResults : tab === "recent" ? recentVessels : historicalVessels;
  const isPending = searching ? searchPending : tab === "recent" ? recentPending : recentPending || allPending;
  const isError = searching ? searchError : tab === "recent" ? recentError : recentError || allError;
  const error = searching ? searchErr : tab === "recent" ? recentErr : recentErr ?? allErr;

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
          <TabButton active={tab === "recent"} onClick={() => setTab("recent")}>
            Recent (last {RECENT_YEARS} years)
          </TabButton>
          <TabButton active={tab === "historical"} onClick={() => setTab("historical")}>
            Historical
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
