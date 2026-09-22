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
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {vessel.type_prefix ? `${vessel.type_prefix} ${vessel.name}` : vessel.name}
        </h1>
        {vessel.loa_ft == null && (
          <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This vessel has no recorded length and can't be booked until one is added.
          </div>
        )}
      </div>

      {isLoggedIn ? (
        <VesselEditForm vessel={vessel} />
      ) : (
        <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
          <dt className="text-slate-500">LOA</dt>
          <dd>{vessel.loa_ft ?? "—"}</dd>
          <dt className="text-slate-500">Draft</dt>
          <dd>{vessel.draft_ft ?? "—"}</dd>
          <dt className="text-slate-500">Notes</dt>
          <dd>{vessel.notes ?? "—"}</dd>
        </dl>
      )}

      {vessel.contacts.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Contacts</h2>
          <ul className="space-y-1 text-sm">
            {vessel.contacts.map((c) => (
              <li key={c.id} className="text-slate-600">
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
                {c.email ? ` · ${c.email}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Upcoming bookings</h2>
        {vessel.upcoming_bookings.length === 0 ? (
          <p className="text-sm text-slate-400">None.</p>
        ) : (
          <BookingSummaryList bookings={vessel.upcoming_bookings} />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Past bookings</h2>
        {vessel.past_bookings.length === 0 ? (
          <p className="text-sm text-slate-400">None.</p>
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
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white text-sm">
      {bookings.map((b) => (
        <li key={b.id} className="flex items-center justify-between px-3 py-2">
          <span>
            <Link to="/" className="text-blue-600 hover:underline">
              {b.berth_name}
            </Link>{" "}
            {formatDateRange(b.start_date, b.end_date)}
          </span>
          <span className="text-xs text-slate-400">{b.status.replace("_", " ")}</span>
        </li>
      ))}
    </ul>
  );
}
