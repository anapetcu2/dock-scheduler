import type { BookingDetail } from "../../api/bookings";
import { KIND_STYLE, STATUS_LABEL, bookingTitle } from "../../lib/bookingDisplay";
import { formatDateRange, formatDisplayDate } from "../../lib/dates";

export function BookingDetailReadOnly({ booking }: { booking: BookingDetail }) {
  const style = KIND_STYLE[booking.kind];

  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <span aria-hidden>{style.icon}</span>
          {bookingTitle(booking)}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full bg-surface-700 px-2 py-0.5 text-xs font-medium text-slate-300">
            {style.label}
          </span>
          <span className="text-xs text-slate-500">{STATUS_LABEL[booking.status]}</span>
        </div>
      </div>
      <dl className="grid grid-cols-[100px_1fr] gap-y-1.5 rounded-lg border border-surface-700 bg-surface-800/50 p-3">
        <dt className="text-slate-500">Berth</dt>
        <dd className="text-slate-200">{booking.berth_name}</dd>
        <dt className="text-slate-500">Dates</dt>
        <dd className="text-slate-200">{formatDateRange(booking.start_date, booking.end_date)}</dd>
        {booking.kind === "vessel" && booking.vessel_loa_ft != null && (
          <>
            <dt className="text-slate-500">Vessel LOA</dt>
            <dd className="text-slate-200">{booking.vessel_loa_ft}ft</dd>
          </>
        )}
        {booking.notes && (
          <>
            <dt className="text-slate-500">Notes</dt>
            <dd className="whitespace-pre-wrap text-slate-200">{booking.notes}</dd>
          </>
        )}
        {booking.source === "import" && booking.source_ref && (
          <>
            <dt className="text-slate-500">Source</dt>
            <dd className="text-xs text-slate-500">Imported from {booking.source_ref}</dd>
          </>
        )}
      </dl>

      {booking.audit_history.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">History</h3>
          <ul className="space-y-1 text-xs text-slate-500">
            {booking.audit_history.map((event) => (
              <li key={event.id}>
                {event.action} on {formatDisplayDate(event.at.slice(0, 10))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
