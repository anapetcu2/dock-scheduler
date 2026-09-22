import { useState } from "react";

import type { Berth } from "../../api/berths";
import type { Booking } from "../../api/bookings";
import { isWeekendISO, maxISO, minISO } from "../../lib/dates";
import { BookingBar } from "./BookingBar";
import { LANE_HEIGHT_PX, clipToRange } from "./gridMath";
import { assignLanes } from "./laneAssignment";

interface ScheduleRowProps {
  berth: Berth;
  days: string[];
  rangeStart: string;
  rangeEnd: string;
  bookings: Booking[];
  canCreate: boolean;
  matches: (booking: Booking) => boolean;
  onOpenBooking: (bookingId: number) => void;
  onCreateBooking: (berthId: number, start: string, end: string) => void;
}

export function ScheduleRow({
  berth,
  days,
  rangeStart,
  rangeEnd,
  bookings,
  canCreate,
  matches,
  onOpenBooking,
  onCreateBooking,
}: ScheduleRowProps) {
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);

  const { laneById, laneCount } = assignLanes(bookings);
  const dragging = dragStart !== null && dragEnd !== null;
  const dragLo = dragging ? minISO(dragStart!, dragEnd!) : null;
  const dragHi = dragging ? maxISO(dragStart!, dragEnd!) : null;

  const finishDrag = () => {
    if (dragStart !== null && dragEnd !== null) {
      onCreateBooking(berth.id, minISO(dragStart, dragEnd), maxISO(dragStart, dragEnd));
    }
    setDragStart(null);
    setDragEnd(null);
  };

  return (
    <div
      className="grid border-b border-slate-100"
      style={{
        gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))`,
        gridAutoRows: LANE_HEIGHT_PX,
        minHeight: laneCount * LANE_HEIGHT_PX,
      }}
      onMouseLeave={() => {
        if (dragging) finishDrag();
      }}
    >
      {canCreate &&
        days.map((day, index) => {
          const inDrag = dragLo !== null && dragHi !== null && day >= dragLo && day <= dragHi;
          return (
            <button
              key={day}
              type="button"
              aria-label={`Book ${berth.name} starting ${day}`}
              className={`h-full w-full ${
                inDrag
                  ? "bg-blue-200"
                  : isWeekendISO(day)
                    ? "bg-slate-50 hover:bg-blue-50"
                    : "hover:bg-blue-50"
              }`}
              style={{ gridColumn: index + 1, gridRow: "1 / -1" }}
              onMouseDown={() => {
                setDragStart(day);
                setDragEnd(day);
              }}
              onMouseEnter={() => {
                if (dragStart !== null) setDragEnd(day);
              }}
              onMouseUp={finishDrag}
            />
          );
        })}

      {bookings.map((booking) => {
        const clip = clipToRange(rangeStart, rangeEnd, booking.start_date, booking.end_date);
        if (clip === null) return null;
        const lane = laneById.get(booking.id) ?? 0;
        return (
          <BookingBar
            key={booking.id}
            booking={booking}
            clip={clip}
            lane={lane}
            dimmed={!matches(booking)}
            onOpen={onOpenBooking}
          />
        );
      })}
    </div>
  );
}
