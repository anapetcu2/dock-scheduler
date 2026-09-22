import { CheckCircle2, Clock, Search, XCircle } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";

import { type AvailabilityQuery, useAvailability } from "../../api/availability";
import type { BerthAvailability } from "../../api/availability";
import { useBerths } from "../../api/berths";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { formatDateRange, todayISO } from "../../lib/dates";
import { cardClass, inputClass, labelClass } from "../../lib/formStyles";
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
    <div className="animate-fade-in-up">
      <h1 className="mb-4 text-xl font-semibold text-slate-100">Find a berth</h1>

      <form onSubmit={onSubmit} className={`${cardClass} mb-6 grid max-w-2xl gap-3 p-4 sm:grid-cols-2`}>
        <div className="sm:col-span-2">
          <span className={labelClass}>Vessel</span>
          <VesselCombobox
            vesselId={vesselId}
            vesselName={vesselName}
            onSelect={(id, name) => {
              setVesselId(id);
              setVesselName(name);
              setLoaFt("");
            }}
          />
          <p className="mt-1 text-xs text-slate-500">Or skip the vessel and enter a length instead:</p>
          <input
            type="number"
            placeholder="Length (ft)"
            className={`${inputClass} mt-1 w-32 py-1`}
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
          <label htmlFor="avail-start" className={labelClass}>
            Start date
          </label>
          <input
            id="avail-start"
            type="date"
            className={`${inputClass} w-full`}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="avail-end" className={labelClass}>
            End date
          </label>
          <input
            id="avail-end"
            type="date"
            className={`${inputClass} w-full`}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" disabled={vesselId == null && loaFt === ""}>
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </form>

      {isPending && submitted && <LoadingState label="Checking availability…" />}
      {isError && <ErrorState error={error} />}

      {results && (
        <div className="space-y-6">
          <ResultGroup
            title="Available and fits"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            results={fitsAndFree}
            onBook={(berthId) => setDrawer({ mode: "create", berthId, start, end })}
          />
          <ResultGroup
            title="Fits but booked"
            icon={<Clock className="h-4 w-4 text-amber-400" />}
            results={fitsButBusy}
          />
          <ResultGroup
            title="Too small"
            icon={<XCircle className="h-4 w-4 text-rose-400" />}
            results={tooSmall}
          />
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
  icon,
  results,
  onBook,
}: {
  title: string;
  icon: ReactNode;
  results: BerthAvailability[];
  onBook?: (berthId: number) => void;
}) {
  if (results.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-200">
        {icon}
        {title} ({results.length})
      </h2>
      <ul className={`${cardClass} divide-y divide-surface-700/60`}>
        {results.map((r) => (
          <li key={r.berth_id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <div className="font-medium text-slate-200">{r.berth_name}</div>
              <div className="text-slate-500">{r.fit_reason}</div>
              {r.conflicts.length > 0 && (
                <div className="mt-1 text-xs text-amber-400">
                  Conflicts:{" "}
                  {r.conflicts
                    .map((c) => `${c.title} (${formatDateRange(c.start_date, c.end_date)})`)
                    .join(", ")}
                </div>
              )}
            </div>
            {onBook && (
              <Button variant="primary" onClick={() => onBook(r.berth_id)}>
                Book this berth
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
