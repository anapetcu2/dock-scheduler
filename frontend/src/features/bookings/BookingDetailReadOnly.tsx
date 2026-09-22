import type { BookingDetail } from "../../api/bookings";
import { KIND_STYLE, STATUS_LABEL, bookingTitle } from "../../lib/bookingDisplay";
import { formatDateRange, formatDisplayDate } from "../../lib/dates";

export function BookingDetailReadOnly({ booking }: { booking: BookingDetail }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="text-lg font-semibold text-slate-900">{bookingTitle(booking)}</div>
        <div className="text-slate-500">
          {KIND_STYLE[booking.kind].label} {"·"} {STATUS_LABEL[booking.status]}
        </div>
      </div>
      <dl className="grid grid-cols-[100px_1fr] gap-y-1">
        <dt className="text-slate-500">Berth</dt>
        <dd>{booking.berth_name}</dd>
        <dt className="text-slate-500">Dates</dt>
        <dd>{formatDateRange(booking.start_date, booking.end_date)}</dd>
        {booking.kind === "vessel" && booking.vessel_loa_ft != null && (
          <>
            <dt className="text-slate-500">Vessel LOA</dt>
            <dd>{booking.vessel_loa_ft}ft</dd>
          </>
        )}
        {booking.notes && (
          <>
            <dt className="text-slate-500">Notes</dt>
            <dd className="whitespace-pre-wrap">{booking.notes}</dd>
          </>
        )}
        {booking.source === "import" && booking.source_ref && (
          <>
            <dt className="text-slate-500">Source</dt>
            <dd className="text-xs text-slate-400">Imported from {booking.source_ref}</dd>
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
