import { useMemo, useState } from "react";

import { useBerths } from "../../api/berths";
import { type Booking, useBookings } from "../../api/bookings";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { useAuth } from "../auth/useAuth";
import { type DrawerState, BookingDrawer } from "../bookings/BookingDrawer";
import { ScheduleFilters, type ScheduleFilterState } from "./ScheduleFilters";
import { ScheduleGrid } from "./ScheduleGrid";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { useScheduleRange } from "./useScheduleRange";

export function SchedulePage() {
  const { isLoggedIn } = useAuth();
  const { view, anchor, range, setView, goPrevious, goNext, goToday, goTo } = useScheduleRange();
  const [filters, setFilters] = useState<ScheduleFilterState>({ kind: "", status: "", vesselQuery: "" });
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });

  const { data: berths, isPending: berthsPending, isError: berthsError, error: berthsErrorObj } =
    useBerths(false);
  const {
    data: bookings,
    isPending: bookingsPending,
    isError: bookingsError,
    error: bookingsErrorObj,
  } = useBookings({
    start: range.start,
    end: range.end,
    kind: filters.kind || undefined,
    status: filters.status || undefined,
  });

  const bookingsByBerth = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const booking of bookings ?? []) {
      const list = map.get(booking.berth_id) ?? [];
      list.push(booking);
      map.set(booking.berth_id, list);
    }
    return map;
  }, [bookings]);

  const matches = (booking: Booking) => {
    if (!filters.vesselQuery) return true;
    const needle = filters.vesselQuery.toLowerCase();
    return (booking.vessel_name ?? booking.title ?? "").toLowerCase().includes(needle);
  };

  if (berthsPending || bookingsPending) return <LoadingState label="Loading schedule…" />;
  if (berthsError) return <ErrorState error={berthsErrorObj} />;
  if (bookingsError) return <ErrorState error={bookingsErrorObj} />;

  return (
    <div className="animate-fade-in-up">
      <h1 className="mb-4 text-xl font-semibold text-slate-100">Schedule</h1>
      <ScheduleToolbar
        view={view}
        anchor={anchor}
        onViewChange={setView}
        onPrevious={goPrevious}
        onNext={goNext}
        onToday={goToday}
        onJump={goTo}
      />
      <ScheduleFilters value={filters} onChange={setFilters} />

      {berths.length === 0 ? (
        <EmptyState>No berths configured yet.</EmptyState>
      ) : (
        <ScheduleGrid
          berths={berths}
          bookingsByBerth={bookingsByBerth}
          rangeStart={range.start}
          rangeEnd={range.end}
          canCreate={isLoggedIn}
          matches={matches}
          onOpenBooking={(bookingId) => setDrawer({ mode: "view", bookingId })}
          onCreateBooking={(berthId, start, end) => setDrawer({ mode: "create", berthId, start, end })}
        />
      )}

      <BookingDrawer
        state={drawer}
        berths={berths}
        onClose={() => setDrawer({ mode: "closed" })}
        onOpenBooking={(bookingId) => setDrawer({ mode: "view", bookingId })}
      />
    </div>
  );
}
