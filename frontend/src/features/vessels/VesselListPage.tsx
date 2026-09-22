import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useOrganizations } from "../../api/organizations";
import { useVessels } from "../../api/vessels";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { formatDisplayDate } from "../../lib/dates";
import { inputClass, tableHeadClass, tableWrapperClass } from "../../lib/formStyles";

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
    <div className="animate-fade-in-up">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Vessels</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            placeholder={"Search vessels…"}
            className={`${inputClass} w-64 py-1.5 pl-8`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {!searching && (
        <div className="mb-4 flex gap-1 border-b border-surface-700">
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
        <table className={`${tableWrapperClass} border-separate border-spacing-0 text-sm`}>
          <thead>
            <tr className={tableHeadClass}>
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
              <tr key={v.id} className="transition-default border-t border-surface-700/60 hover:bg-surface-800/60">
                <td className="px-3 py-2 font-medium text-slate-200">
                  <Link to={`/vessels/${v.id}`} className="hover:text-brand-300">
                    {v.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-300">{v.type_prefix ?? "—"}</td>
                <td className="px-3 py-2 text-slate-300">
                  {v.loa_ft ?? <span className="text-amber-400">Unknown</span>}
                </td>
                <td className="px-3 py-2 text-slate-300">{v.draft_ft ?? "—"}</td>
                <td className="px-3 py-2 text-slate-300">{orgName(v.organization_id)}</td>
                <td className="px-3 py-2 text-slate-500">
                  {v.last_booked_date ? formatDisplayDate(v.last_booked_date) : "Never"}
                </td>
                <td className="px-3 py-2 text-right">
                  {v.loa_ft == null && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
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
      className={`transition-default border-b-2 px-3 py-2 text-sm font-medium ${
        active ? "border-brand-500 text-brand-300" : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
