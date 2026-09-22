import { Link } from "react-router-dom";

import type { Berth } from "../../api/berths";
import type { Booking } from "../../api/bookings";
import { eachISODayInRange } from "../../lib/dates";
import { LANE_HEIGHT_PX } from "./gridMath";
import { assignLanes } from "./laneAssignment";
import { ScheduleHeader } from "./ScheduleHeader";
import { ScheduleRow } from "./ScheduleRow";

interface ScheduleGridProps {
  berths: Berth[];
  bookingsByBerth: Map<number, Booking[]>;
  rangeStart: string;
  rangeEnd: string;
  canCreate: boolean;
  matches: (booking: Booking) => boolean;
  onOpenBooking: (bookingId: number) => void;
  onCreateBooking: (berthId: number, start: string, end: string) => void;
}

const LABEL_COLUMN_WIDTH = 176;
const HEADER_HEIGHT = 40;

export function ScheduleGrid({
  berths,
  bookingsByBerth,
  rangeStart,
  rangeEnd,
  canCreate,
  matches,
  onOpenBooking,
  onCreateBooking,
}: ScheduleGridProps) {
  const days = eachISODayInRange(rangeStart, rangeEnd);

  return (
    <div className="flex overflow-hidden rounded-xl border border-surface-700 bg-surface-850 shadow-panel">
      <div className="shrink-0 border-r border-surface-700" style={{ width: LABEL_COLUMN_WIDTH }}>
        <div className="border-b border-surface-700 bg-surface-800/60" style={{ height: HEADER_HEIGHT }} />
        {berths.map((berth) => {
          const bookings = bookingsByBerth.get(berth.id) ?? [];
          const { laneCount } = assignLanes(bookings);
          return (
            <Link
              key={berth.id}
              to={`/berths`}
              className="transition-default flex items-center border-b border-surface-700/60 px-3 text-sm font-medium text-slate-300 hover:bg-surface-800 hover:text-white"
              style={{ height: laneCount * LANE_HEIGHT_PX }}
            >
              <span className="truncate">{berth.name}</span>
              {berth.length_ft == null && (
                <span className="ml-1 shrink-0 text-xs text-amber-400" title="Length unknown">
                  {"⚠"}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto">
        <div style={{ minWidth: days.length * 28 }}>
          <ScheduleHeader days={days} />
          {berths.map((berth) => (
            <ScheduleRow
              key={berth.id}
              berth={berth}
              days={days}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              bookings={bookingsByBerth.get(berth.id) ?? []}
              canCreate={canCreate}
              matches={matches}
              onOpenBooking={onOpenBooking}
              onCreateBooking={onCreateBooking}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
