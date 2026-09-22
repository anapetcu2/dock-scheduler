"""Live data-health checks (SPEC.md section 8.7). Computed fresh on every
request from current data, never stored — unlike import_issues, so fixing
a vessel's length makes its issues disappear on the next page load rather
than needing a re-import.
"""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.models.bookings import Booking, BookingKind, BookingStatus
from app.models.vessels import Vessel

# Bookings in these statuses actually hold a berth (mirrors
# booking_rules.BLOCKING_STATUSES plus legacy_conflict, since a historical
# conflict is exactly the kind of thing this page exists to surface).
LIVE_STATUSES = (BookingStatus.tentative, BookingStatus.confirmed, BookingStatus.legacy_conflict)


@dataclass(frozen=True)
class IntegrityIssue:
    code: str
    severity: str  # "error" | "warning"
    message: str
    booking_id: int | None = None
    vessel_id: int | None = None
    berth_id: int | None = None
    related_booking_id: int | None = None


def _vessel_label(vessel: Vessel) -> str:
    return f"{vessel.type_prefix} {vessel.name}" if vessel.type_prefix else vessel.name


def _format_feet(value: float) -> str:
    value = float(value)
    return f"{int(value)}′" if value == int(value) else f"{value:.1f}′"


def compute_integrity_issues(session: Session) -> list[IntegrityIssue]:
    settings = get_settings()
    issues: list[IntegrityIssue] = []

    vessel_bookings = session.scalars(
        select(Booking)
        .options(joinedload(Booking.vessel), joinedload(Booking.berth))
        .where(Booking.kind == BookingKind.vessel, Booking.status.in_(LIVE_STATUSES))
    ).unique()

    for booking in vessel_bookings:
        vessel, berth = booking.vessel, booking.berth
        if vessel is None or berth is None:
            continue

        if vessel.loa_ft is None:
            issues.append(
                IntegrityIssue(
                    "VESSEL_LENGTH_UNKNOWN",
                    "warning",
                    f"Booking #{booking.id}: {_vessel_label(vessel)} has no recorded length.",
                    booking_id=booking.id,
                    vessel_id=vessel.id,
                    berth_id=berth.id,
                )
            )
        if berth.length_ft is None:
            issues.append(
                IntegrityIssue(
                    "BERTH_LENGTH_UNKNOWN",
                    "warning",
                    f'Booking #{booking.id}: "{berth.name}" has no recorded length.',
                    booking_id=booking.id,
                    vessel_id=vessel.id,
                    berth_id=berth.id,
                )
            )
        if vessel.loa_ft is not None and berth.length_ft is not None:
            required_ft = float(vessel.loa_ft) + settings.fit_margin_ft
            if required_ft > float(berth.length_ft):
                issues.append(
                    IntegrityIssue(
                        "VESSEL_TOO_LONG",
                        "error",
                        f"Booking #{booking.id}: {_vessel_label(vessel)} "
                        f"({_format_feet(vessel.loa_ft)}) does not fit "
                        f'"{berth.name}" ({_format_feet(berth.length_ft)}).',
                        booking_id=booking.id,
                        vessel_id=vessel.id,
                        berth_id=berth.id,
                    )
                )

    legacy_bookings = session.scalars(
        select(Booking).where(Booking.status == BookingStatus.legacy_conflict)
    ).all()
    for booking in legacy_bookings:
        overlap_expr = func.daterange(Booking.start_date, Booking.end_date, "[]").op("&&")(
            func.daterange(booking.start_date, booking.end_date, "[]")
        )
        others = session.scalars(
            select(Booking).where(
                Booking.berth_id == booking.berth_id,
                Booking.id != booking.id,
                Booking.status != BookingStatus.cancelled,
                overlap_expr,
            )
        ).all()
        for other in others:
            issues.append(
                IntegrityIssue(
                    "HISTORICAL_OVERLAP",
                    "warning",
                    f"Booking #{booking.id} ({booking.start_date}–{booking.end_date}) conflicts "
                    f"with #{other.id} ({other.start_date}–{other.end_date}) on the same berth.",
                    booking_id=booking.id,
                    berth_id=booking.berth_id,
                    related_booking_id=other.id,
                )
            )

        # A vessel can't be in two places at once — the same overlap check
        # as above, but keyed on vessel_id across *different* berths (a
        # same-berth clash is already reported as HISTORICAL_OVERLAP).
        if booking.vessel_id is not None:
            vessel_others = session.scalars(
                select(Booking).where(
                    Booking.vessel_id == booking.vessel_id,
                    Booking.berth_id != booking.berth_id,
                    Booking.id != booking.id,
                    Booking.status != BookingStatus.cancelled,
                    overlap_expr,
                )
            ).all()
            for other in vessel_others:
                issues.append(
                    IntegrityIssue(
                        "VESSEL_DOUBLE_BOOKED",
                        "warning",
                        f"Booking #{booking.id} ({booking.start_date}–{booking.end_date}) "
                        f'books the same vessel as #{other.id} on "{other.berth.name}" '
                        f"({other.start_date}–{other.end_date}).",
                        booking_id=booking.id,
                        vessel_id=booking.vessel_id,
                        related_booking_id=other.id,
                    )
                )

    return issues
