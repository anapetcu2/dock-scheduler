/**
 * All date math for the app lives here. Bookings are whole days with
 * inclusive start/end (SPEC.md section 4): no times, no time zones. Dates
 * cross the API boundary as plain `YYYY-MM-DD` strings and are only turned
 * into a `Date` object briefly, inside this module, for arithmetic —
 * `parseISO` (date-fns) reads a date-only string as local midnight, so it
 * never shifts a day the way `new Date("2024-01-01")` can.
 */
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  format,
  formatISO as dateFnsFormatISO,
  getDay,
  isSameDay,
  isValid,
  parseISO as dateFnsParseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

export type ViewRange = "2w" | "month";

export function parseISODate(value: string): Date {
  const date = dateFnsParseISO(value);
  if (!isValid(date)) {
    throw new Error(`Invalid date string: ${value}`);
  }
  return date;
}

export function toISODate(date: Date): string {
  return dateFnsFormatISO(date, { representation: "date" });
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(value: string, amount: number): string {
  return toISODate(addDays(parseISODate(value), amount));
}

export function isTodayISO(value: string): boolean {
  return isSameDay(parseISODate(value), new Date());
}

export function isWeekendISO(value: string): boolean {
  const day = getDay(parseISODate(value));
  return day === 0 || day === 6;
}

export function isMonthStartISO(value: string): boolean {
  return parseISODate(value).getDate() === 1;
}

export function compareISODate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isBeforeISO(a: string, b: string): boolean {
  return a < b;
}

export function isAfterISO(a: string, b: string): boolean {
  return a > b;
}

export function maxISO(a: string, b: string): string {
  return a > b ? a : b;
}

export function minISO(a: string, b: string): string {
  return a < b ? a : b;
}

/** Inclusive day count, matching SPEC.md's "Oct 3-Oct 9 occupies 7 days". */
export function daysBetweenInclusive(startValue: string, endValue: string): number {
  const start = parseISODate(startValue);
  const end = parseISODate(endValue);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function eachISODayInRange(startValue: string, endValue: string): string[] {
  return eachDayOfInterval({ start: parseISODate(startValue), end: parseISODate(endValue) }).map(
    toISODate,
  );
}

export function formatDayNumber(value: string): string {
  return format(parseISODate(value), "d");
}

export function formatWeekdayShort(value: string): string {
  return format(parseISODate(value), "EEEEE");
}

export function formatMonthLabel(value: string): string {
  return format(parseISODate(value), "MMMM yyyy");
}

export function formatDisplayDate(value: string): string {
  return format(parseISODate(value), "MMM d, yyyy");
}

export function formatDateRange(startValue: string, endValue: string): string {
  if (startValue === endValue) {
    return formatDisplayDate(startValue);
  }
  return `${formatDisplayDate(startValue)} – ${formatDisplayDate(endValue)}`;
}

/** Given any date in the view and a view size, returns the [start, end]
 * (inclusive) range to display. "month" always snaps to the full calendar
 * month so month boundaries in the grid line up cleanly; "2w" is a rolling
 * two-week window starting on `anchorValue`. */
export function viewRangeFor(view: ViewRange, anchorValue: string): { start: string; end: string } {
  const anchor = parseISODate(anchorValue);
  if (view === "2w") {
    return { start: toISODate(anchor), end: toISODate(addDays(anchor, 13)) };
  }
  const start = startOfMonth(anchor);
  const end = subDays(addMonths(start, 1), 1);
  return { start: toISODate(start), end: toISODate(end) };
}

/** Moves the anchor date one view "page" forward/back, e.g. the whole
 * visible month when view === "month". */
export function shiftAnchor(view: ViewRange, anchorValue: string, direction: 1 | -1): string {
  const anchor = parseISODate(anchorValue);
  if (view === "2w") {
    return toISODate(addDays(anchor, direction * 14));
  }
  const shifted = direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
  return toISODate(startOfMonth(shifted));
}
