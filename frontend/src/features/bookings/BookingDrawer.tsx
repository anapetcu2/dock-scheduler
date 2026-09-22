import type { Berth } from "../../api/berths";
import { useBooking, useCancelBooking, useDeleteBooking } from "../../api/bookings";
import { Button } from "../../components/Button";
import { Drawer } from "../../components/Drawer";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { useAuth } from "../auth/useAuth";
import { BookingDetailReadOnly } from "./BookingDetailReadOnly";
import { BookingForm } from "./BookingForm";

export type DrawerState =
  | { mode: "closed" }
  | { mode: "create"; berthId: number; start: string; end: string }
  | { mode: "view"; bookingId: number };

const ADMIN_ONLY_EDIT_STATUSES = new Set(["cancelled", "legacy_conflict"]);

interface BookingDrawerProps {
  state: DrawerState;
  berths: Berth[];
  onClose: () => void;
  onOpenBooking: (bookingId: number) => void;
}

export function BookingDrawer({ state, berths, onClose, onOpenBooking }: BookingDrawerProps) {
  const { isLoggedIn, isAdmin } = useAuth();

  if (state.mode === "closed") {
    return null;
  }

  if (state.mode === "create") {
    return (
      <Drawer open title="New booking" onClose={onClose}>
        <BookingForm
          berths={berths}
          defaults={{ berth_id: state.berthId, start_date: state.start, end_date: state.end }}
          onSaved={onClose}
          onOpenConflict={onOpenBooking}
        />
      </Drawer>
    );
  }

  return (
    <ViewDrawer
      bookingId={state.bookingId}
      berths={berths}
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      onClose={onClose}
      onOpenBooking={onOpenBooking}
    />
  );
}

function ViewDrawer({
  bookingId,
  berths,
  isLoggedIn,
  isAdmin,
  onClose,
  onOpenBooking,
}: {
  bookingId: number;
  berths: Berth[];
  isLoggedIn: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onOpenBooking: (bookingId: number) => void;
}) {
  const { data: booking, isPending, isError, error } = useBooking(bookingId);
  const cancelBooking = useCancelBooking();
  const deleteBooking = useDeleteBooking();

  const canEdit =
    isLoggedIn && booking !== undefined && (isAdmin || !ADMIN_ONLY_EDIT_STATUSES.has(booking.status));

  return (
    <Drawer open title="Booking" onClose={onClose}>
      {isPending && <LoadingState label="Loading booking…" />}
      {isError && <ErrorState error={error} />}
      {booking && (
        <div className="space-y-4">
          {canEdit ? (
            <BookingForm
              berths={berths}
              editing={booking}
              defaults={{
                berth_id: booking.berth_id,
                start_date: booking.start_date,
                end_date: booking.end_date,
              }}
              onSaved={onClose}
              onOpenConflict={onOpenBooking}
            />
          ) : (
            <>
              <BookingDetailReadOnly booking={booking} />
              {isLoggedIn && !canEdit && (
                <p className="text-xs text-slate-500">
                  Only an admin can edit a {booking.status.replace("_", " ")} booking.
                </p>
              )}
            </>
          )}

          {isLoggedIn && booking.status !== "cancelled" && (
            <div className="flex gap-2 border-t border-surface-700 pt-3">
              <Button
                variant="secondary"
                disabled={cancelBooking.isPending}
                onClick={() => cancelBooking.mutate(booking.id)}
              >
                Cancel booking
              </Button>
              {isAdmin && (
                <Button
                  variant="danger"
                  disabled={deleteBooking.isPending}
                  onClick={() => deleteBooking.mutate(booking.id, { onSuccess: onClose })}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
          {cancelBooking.isError && <ErrorState error={cancelBooking.error} />}
          {deleteBooking.isError && <ErrorState error={deleteBooking.error} />}
        </div>
      )}
    </Drawer>
  );
}
