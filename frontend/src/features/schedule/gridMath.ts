import { compareISODate, daysBetweenInclusive, maxISO, minISO } from "../../lib/dates";

// Made deliberately roomy: with only a handful of berths, the grid has
// plenty of vertical space to spend on taller, easier-to-read/click rows
// instead of packing them tight the way a busy 50-row grid would need to.
export const LANE_HEIGHT_PX = 44;
export const DAY_COLUMN_MIN_PX = 44;
export const ROW_GAP_PX = 4;

/** 1-based column index of `value` within [rangeStart, rangeEnd]. */
export function dayColumn(rangeStart: string, value: string): number {
  return daysBetweenInclusive(rangeStart, value);
}

export interface ClippedSpan {
  startColumn: number;
  span: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

/** Clips a booking's date range to the visible [rangeStart, rangeEnd]
 * window and returns its CSS grid column placement, plus whether either
 * edge was clipped (so the bar can show a continuation arrow). Returns
 * null if the booking doesn't overlap the range at all. */
export function clipToRange(
  rangeStart: string,
  rangeEnd: string,
  bookingStart: string,
  bookingEnd: string,
): ClippedSpan | null {
  if (compareISODate(bookingEnd, rangeStart) < 0 || compareISODate(bookingStart, rangeEnd) > 0) {
    return null;
  }
  const clippedStartDate = maxISO(rangeStart, bookingStart);
  const clippedEndDate = minISO(rangeEnd, bookingEnd);
  const startColumn = dayColumn(rangeStart, clippedStartDate);
  const endColumn = dayColumn(rangeStart, clippedEndDate);
  return {
    startColumn,
    span: endColumn - startColumn + 1,
    clippedStart: compareISODate(bookingStart, rangeStart) < 0,
    clippedEnd: compareISODate(bookingEnd, rangeEnd) > 0,
  };
}
