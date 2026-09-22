"""Create/update/cancel bookings. Every write that can hold a berth goes
through `validate_booking` first; see booking_rules.py for the rules
themselves.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.audit import AuditAction
from app.models.bookings import Booking, BookingKind, BookingSource, BookingStatus
from app.services.audit import record_audit_event
from app.services.booking_rules import BookingProposal, validate_booking
from app.services.exceptions import BookingConflictError, BookingValidationError

OVERLAP_CONSTRAINT_NAME = "bookings_no_overlap"


@dataclass(frozen=True)
class BookingInput:
    """The full desired state of a booking, for create or update.

    For updates, the caller (the API router) is responsible for merging a
    partial PATCH body onto the booking's current values to build this.
    """

    berth_id: int
    kind: BookingKind
    start_date: date
    end_date: date
    status: BookingStatus
    vessel_id: int | None = None
    title: str | None = None
    notes: str | None = None


def _proposal(data: BookingInput) -> BookingProposal:
    return BookingProposal(
        berth_id=data.berth_id,
        kind=data.kind,
        start_date=data.start_date,
        end_date=data.end_date,
        status=data.status,
        vessel_id=data.vessel_id,
        title=data.title,
    )


def _snapshot(booking: Booking) -> dict[str, Any]:
    return {
        "berth_id": booking.berth_id,
        "kind": booking.kind.value,
        "vessel_id": booking.vessel_id,
        "title": booking.title,
        "start_date": booking.start_date.isoformat(),
        "end_date": booking.end_date.isoformat(),
        "status": booking.status.value,
        "notes": booking.notes,
    }


def _is_overlap_violation(exc: IntegrityError) -> bool:
    diag = getattr(exc.orig, "diag", None)
    return getattr(diag, "constraint_name", None) == OVERLAP_CONSTRAINT_NAME


def _apply(booking: Booking, data: BookingInput) -> None:
    booking.berth_id = data.berth_id
    booking.kind = data.kind
    booking.vessel_id = data.vessel_id
    booking.title = data.title
    booking.start_date = data.start_date
    booking.end_date = data.end_date
    booking.status = data.status
    booking.notes = data.notes


def _write_or_conflict(
    session: Session,
    proposal: BookingProposal,
    exclude_booking_id: int | None,
    mutate: Callable[[], None],
) -> None:
    """Run `mutate` (an add or an attribute change) and flush it inside a
    SAVEPOINT, so a constraint violation can be recovered from without
    losing the caller's outer transaction.

    `mutate` must run *inside* the SAVEPOINT, not before `begin_nested()` is
    called: `begin_nested()` itself flushes any already-pending changes
    first (to snapshot state), which would run the write before the
    SAVEPOINT exists to protect it.
    """
    try:
        with session.begin_nested():
            mutate()
            session.flush()
    except IntegrityError as exc:
        if not _is_overlap_violation(exc):
            raise
        # The savepoint rollback undid the failed write, but the mutated
        # object may still be pending/dirty in the session. Querying for the
        # conflict without no_autoflush would trigger autoflush, retrying
        # that same write outside any savepoint and corrupting the whole
        # transaction instead of just this one.
        with session.no_autoflush:
            conflict_result = validate_booking(
                session, proposal, exclude_booking_id=exclude_booking_id
            )
        raise BookingConflictError(conflict_result) from exc


def create_booking(session: Session, data: BookingInput, *, created_by: int | None) -> Booking:
    proposal = _proposal(data)
    result = validate_booking(session, proposal)
    if not result.ok:
        raise BookingValidationError(result)

    booking = Booking(
        berth_id=data.berth_id,
        kind=data.kind,
        vessel_id=data.vessel_id,
        title=data.title,
        start_date=data.start_date,
        end_date=data.end_date,
        status=data.status,
        notes=data.notes,
        source=BookingSource.app,
        created_by=created_by,
    )
    _write_or_conflict(session, proposal, None, lambda: session.add(booking))

    record_audit_event(
        session,
        user_id=created_by,
        action=AuditAction.create,
        entity_type="booking",
        entity_id=booking.id,
        before=None,
        after=_snapshot(booking),
    )
    return booking


def update_booking(
    session: Session, booking: Booking, data: BookingInput, *, user_id: int | None
) -> Booking:
    proposal = _proposal(data)
    result = validate_booking(session, proposal, exclude_booking_id=booking.id)
    if not result.ok:
        raise BookingValidationError(result)

    before = _snapshot(booking)
    _write_or_conflict(session, proposal, booking.id, lambda: _apply(booking, data))

    record_audit_event(
        session,
        user_id=user_id,
        action=AuditAction.update,
        entity_type="booking",
        entity_id=booking.id,
        before=before,
        after=_snapshot(booking),
    )
    return booking


def cancel_booking(session: Session, booking: Booking, *, user_id: int | None) -> Booking:
    """Cancelling always relinquishes the hold, so it never needs
    `validate_booking` — a cancelled booking can't fail any rule."""
    before = _snapshot(booking)
    booking.status = BookingStatus.cancelled
    session.flush()

    record_audit_event(
        session,
        user_id=user_id,
        action=AuditAction.cancel,
        entity_type="booking",
        entity_id=booking.id,
        before=before,
        after=_snapshot(booking),
    )
    return booking


def delete_booking(session: Session, booking: Booking, *, user_id: int | None) -> None:
    before = _snapshot(booking)
    booking_id = booking.id
    session.delete(booking)
    session.flush()

    record_audit_event(
        session,
        user_id=user_id,
        action=AuditAction.delete,
        entity_type="booking",
        entity_id=booking_id,
        before=before,
        after=None,
    )
