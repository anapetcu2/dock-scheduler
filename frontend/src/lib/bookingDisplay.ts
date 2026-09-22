import type { BookingKind, BookingStatus } from "../api/bookings";

/** Colors and icons by kind (never color alone, per SPEC.md section 9.1). */
export const KIND_STYLE: Record<BookingKind, { label: string; bar: string; icon: string }> = {
  vessel: { label: "Vessel", bar: "bg-vessel", icon: "⛵" },
  event: { label: "Event", bar: "bg-event", icon: "★" },
  closure: { label: "Closure", bar: "bg-closure", icon: "⚠" },
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  legacy_conflict: "Historical conflict",
};

export function bookingTitle(booking: {
  title: string | null;
  vessel_name: string | null;
}): string {
  return booking.title ?? booking.vessel_name ?? "Untitled booking";
}
