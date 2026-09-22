import type { Booking } from "../../api/bookings";
import { KIND_STYLE, bookingTitle } from "../../lib/bookingDisplay";
import { formatDateRange } from "../../lib/dates";
import type { ClippedSpan } from "./gridMath";

interface BookingBarProps {
  booking: Booking;
  clip: ClippedSpan;
  lane: number;
  dimmed: boolean;
  onOpen: (bookingId: number) => void;
}

export function BookingBar({ booking, clip, lane, dimmed, onOpen }: BookingBarProps) {
  const style = KIND_STYLE[booking.kind];
  const isConflict = booking.status === "legacy_conflict";
  const isTentative = booking.status === "tentative";
  const isCancelled = booking.status === "cancelled";

  const label = `${style.label}: ${bookingTitle(booking)}, ${formatDateRange(
    booking.start_date,
    booking.end_date,
  )}, ${booking.status.replace("_", " ")}${
    booking.kind === "vessel" && booking.vessel_loa_ft != null ? `, ${booking.vessel_loa_ft}ft` : ""
  }`;

  return (
    <button
      type="button"
      onClick={() => onOpen(booking.id)}
      title={label}
      aria-label={label}
      className={`group relative flex items-center gap-1 overflow-hidden rounded px-1.5 text-left text-xs font-medium text-white shadow-sm transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-1 ${style.bar} ${
        isConflict ? "ring-2 ring-red-500 ring-offset-1" : ""
      } ${isCancelled ? "opacity-40 line-through" : dimmed ? "opacity-30" : ""}`}
      style={{
        gridColumn: `${clip.startColumn + 1} / span ${clip.span}`,
        gridRow: lane + 1,
        height: 24,
        backgroundImage: isTentative
          ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0, rgba(255,255,255,0.35) 4px, transparent 4px, transparent 8px)"
          : undefined,
      }}
    >
      {clip.clippedStart && <span aria-hidden>{"◀"}</span>}
      {isConflict && <span aria-hidden>{"⚠"}</span>}
      <span className="truncate">{bookingTitle(booking)}</span>
      {clip.clippedEnd && <span aria-hidden className="ml-auto">{"▶"}</span>}
    </button>
  );
}
