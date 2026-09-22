import { AlertTriangle } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { useVessel } from "../../api/vessels";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { formatDateRange } from "../../lib/dates";
import { useAuth } from "../auth/useAuth";
import { VesselEditForm } from "./VesselEditForm";

export function VesselDetailPage() {
  const { vesselId } = useParams();
  const id = vesselId ? Number(vesselId) : undefined;
  const { data: vessel, isPending, isError, error } = useVessel(id);
  const { isLoggedIn } = useAuth();

  if (isPending) return <LoadingState label="Loading vessel…" />;
  if (isError) return <ErrorState error={error} />;
  if (!vessel) return null;

  return (
    <div className="animate-fade-in-up max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">
          {vessel.type_prefix ? `${vessel.type_prefix} ${vessel.name}` : vessel.name}
        </h1>
        {vessel.loa_ft == null && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This vessel has no recorded length and can't be booked until one is added.
          </div>
        )}
      </div>

      {isLoggedIn ? (
        <VesselEditForm vessel={vessel} />
      ) : (
        <dl className="grid grid-cols-[120px_1fr] gap-y-1 rounded-lg border border-surface-700 bg-surface-850 p-4 text-sm">
          <dt className="text-slate-500">LOA</dt>
          <dd className="text-slate-200">{vessel.loa_ft ?? "—"}</dd>
          <dt className="text-slate-500">Draft</dt>
          <dd className="text-slate-200">{vessel.draft_ft ?? "—"}</dd>
          <dt className="text-slate-500">Notes</dt>
          <dd className="text-slate-200">{vessel.notes ?? "—"}</dd>
        </dl>
      )}

      {vessel.contacts.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Contacts</h2>
          <ul className="space-y-1 text-sm">
            {vessel.contacts.map((c) => (
              <li key={c.id} className="text-slate-400">
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
                {c.email ? ` · ${c.email}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Upcoming bookings</h2>
        {vessel.upcoming_bookings.length === 0 ? (
          <p className="text-sm text-slate-500">None.</p>
        ) : (
          <BookingSummaryList bookings={vessel.upcoming_bookings} />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Past bookings</h2>
        {vessel.past_bookings.length === 0 ? (
          <p className="text-sm text-slate-500">None.</p>
        ) : (
          <BookingSummaryList bookings={vessel.past_bookings} />
        )}
      </section>
    </div>
  );
}

function BookingSummaryList({
  bookings,
}: {
  bookings: { id: number; berth_name: string; start_date: string; end_date: string; status: string }[];
}) {
  return (
    <ul className="divide-y divide-surface-700/60 rounded-lg border border-surface-700 bg-surface-850 text-sm">
      {bookings.map((b) => (
        <li key={b.id} className="flex items-center justify-between px-3 py-2">
          <span className="text-slate-300">
            <Link to="/" className="text-brand-400 hover:text-brand-300 hover:underline">
              {b.berth_name}
            </Link>{" "}
            {formatDateRange(b.start_date, b.end_date)}
          </span>
          <span className="text-xs text-slate-500">{b.status.replace("_", " ")}</span>
        </li>
      ))}
    </ul>
  );
}
