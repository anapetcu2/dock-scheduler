import { type FormEvent, useState } from "react";
import { useLocation } from "react-router-dom";

import { type AvailabilityQuery, useAvailability } from "../../api/availability";
import type { BerthAvailability } from "../../api/availability";
import { useBerths } from "../../api/berths";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { formatDateRange, todayISO } from "../../lib/dates";
import { BookingDrawer, type DrawerState } from "../bookings/BookingDrawer";
import { VesselCombobox } from "../bookings/VesselCombobox";

interface AvailabilityNavState {
  vesselId?: number | null;
  vesselName?: string | null;
  start?: string;
  end?: string;
}

export function AvailabilityPage() {
  const navState = (useLocation().state as AvailabilityNavState | null) ?? {};
  const [vesselId, setVesselId] = useState<number | null>(navState.vesselId ?? null);
  const [vesselName, setVesselName] = useState<string | null>(navState.vesselName ?? null);
  const [loaFt, setLoaFt] = useState("");
  const [start, setStart] = useState(navState.start ?? todayISO());
  const [end, setEnd] = useState(navState.end ?? todayISO());
  const [submitted, setSubmitted] = useState<AvailabilityQuery | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });

  const { data: berths } = useBerths();
  const { data: results, isPending, isError, error } = useAvailability(submitted);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted({
      start,
      end,
      vesselId: vesselId ?? undefined,
      loaFt: vesselId == null && loaFt !== "" ? Number(loaFt) : undefined,
    });
  };

  const fitsAndFree = results?.filter((r) => r.fits && r.free) ?? [];
  const fitsButBusy = results?.filter((r) => r.fits && !r.free) ?? [];
  const tooSmall = results?.filter((r) => !r.fits) ?? [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Find a berth</h1>

      <form onSubmit={onSubmit} className="mb-6 grid max-w-2xl gap-3 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Vessel</span>
          <VesselCombobox
            vesselId={vesselId}
            vesselName={vesselName}
            onSelect={(id, name) => {
              setVesselId(id);
              setVesselName(name);
              setLoaFt("");
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            Or skip the vessel and enter a length instead:
          </p>
          <input
            type="number"
            placeholder="Length (ft)"
            className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={loaFt}
            onChange={(e) => {
              setLoaFt(e.target.value);
              if (e.target.value) {
                setVesselId(null);
                setVesselName(null);
              }
            }}
          />
        </div>
        <div>
          <label htmlFor="avail-start" className="mb-1 block text-sm font-medium text-slate-700">
            Start date
          </label>
          <input
            id="avail-start"
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="avail-end" className="mb-1 block text-sm font-medium text-slate-700">
            End date
          </label>
          <input
            id="avail-end"
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={vesselId == null && loaFt === ""}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            Search
          </button>
        </div>
      </form>

      {isPending && submitted && <LoadingState label="Checking availability…" />}
      {isError && <ErrorState error={error} />}

      {results && (
        <div className="space-y-6">
          <ResultGroup
            title="Available and fits"
            results={fitsAndFree}
            onBook={(berthId) => setDrawer({ mode: "create", berthId, start, end })}
          />
          <ResultGroup title="Fits but booked" results={fitsButBusy} />
          <ResultGroup title="Too small" results={tooSmall} />
        </div>
      )}

      <BookingDrawer
        state={drawer}
        berths={berths ?? []}
        onClose={() => setDrawer({ mode: "closed" })}
        onOpenBooking={(bookingId) => setDrawer({ mode: "view", bookingId })}
      />
    </div>
  );
}

function ResultGroup({
  title,
  results,
  onBook,
}: {
  title: string;
  results: BerthAvailability[];
  onBook?: (berthId: number) => void;
}) {
  if (results.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        {title} ({results.length})
      </h2>
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
        {results.map((r) => (
          <li key={r.berth_id} className="flex items-center justify-between px-4 py-2 text-sm">
            <div>
              <div className="font-medium text-slate-800">{r.berth_name}</div>
              <div className="text-slate-500">{r.fit_reason}</div>
              {r.conflicts.length > 0 && (
                <div className="mt-1 text-xs text-amber-700">
                  Conflicts:{" "}
                  {r.conflicts
                    .map((c) => `${c.title} (${formatDateRange(c.start_date, c.end_date)})`)
                    .join(", ")}
                </div>
              )}
            </div>
            {onBook && (
              <button
                type="button"
                onClick={() => onBook(r.berth_id)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Book this berth
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
