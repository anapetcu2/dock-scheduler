import type { Booking } from "../../api/bookings";
import { compareISODate } from "../../lib/dates";

/** Greedily assigns each booking to the lowest-numbered sub-lane whose
 * previous occupant doesn't overlap it, so overlapping bookings on the same
 * berth (mainly legacy_conflict rows) stack into separate visual rows
 * instead of hiding one another. See SPEC.md section 9.1. */
export function assignLanes(bookings: Booking[]): { laneById: Map<number, number>; laneCount: number } {
  const sorted = [...bookings].sort(
    (a, b) => compareISODate(a.start_date, b.start_date) || compareISODate(a.end_date, b.end_date),
  );
  const laneEndDates: string[] = [];
  const laneById = new Map<number, number>();

  for (const booking of sorted) {
    let lane = laneEndDates.findIndex((endDate) => endDate < booking.start_date);
    if (lane === -1) {
      lane = laneEndDates.length;
      laneEndDates.push(booking.end_date);
    } else {
      laneEndDates[lane] = booking.end_date;
    }
    laneById.set(booking.id, lane);
  }

  return { laneById, laneCount: Math.max(1, laneEndDates.length) };
}
