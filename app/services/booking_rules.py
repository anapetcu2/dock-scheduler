"""Single source of truth for whether a booking may be saved.

`validate_booking` is called by the create/update endpoints and by the
dry-run `/api/bookings/validate` endpoint. Nothing else on the backend
re-implements these rules; the frontend only displays what this returns.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.berths import Berth
from app.models.bookings import Booking, BookingKind, BookingStatus
from app.models.vessels import Vessel
from app.schemas.validation import Issue, ValidationResult

# Overlap and OVERLAP-error checks only consider bookings in these statuses,
# matching the `bookings_no_overlap` exclusion constraint's WHERE clause.
BLOCKING_STATUSES = (BookingStatus.tentative, BookingStatus.confirmed)


@dataclass(frozen=True)
class BookingProposal:
    """The state a booking would have after the save being validated."""

    berth_id: int
    kind: BookingKind
    start_date: date
    end_date: date
    status: BookingStatus
    vessel_id: int | None = None
    title: str | None = None


def _format_feet(value: float) -> str:
    value = float(value)
    if value == int(value):
        return f"{int(value)}′"
    return f"{value:.1f}′"


def _vessel_label(vessel: Vessel) -> str:
    if vessel.type_prefix:
        return f"{vessel.type_prefix} {vessel.name}"
    return vessel.name


def _booking_label(booking: Booking) -> str:
    """Display title for a booking: its own title, or its vessel's name."""
    if booking.title:
        return booking.title
    if booking.vessel is not None:
        return _vessel_label(booking.vessel)
    return f"booking #{booking.id}"


def _format_date_range(start: date, end: date) -> str:
    return f"{start.isoformat()}–{end.isoformat()}"


def validate_booking(
    session: Session,
    proposal: BookingProposal,
    exclude_booking_id: int | None = None,
) -> ValidationResult:
    settings = get_settings()
    errors: list[Issue] = []
    warnings: list[Issue] = []

    dates_valid = proposal.end_date >= proposal.start_date
    if not dates_valid:
        errors.append(
            Issue(
                code="INVALID_DATES",
                message="End date is before start date.",
                field="end_date",
            )
        )

    if proposal.kind == BookingKind.vessel and proposal.vessel_id is None:
        errors.append(
            Issue(
                code="MISSING_VESSEL",
                message="A vessel is required for a vessel booking.",
                field="vessel_id",
            )
        )
    if proposal.kind != BookingKind.vessel and not proposal.title:
        errors.append(
            Issue(
                code="MISSING_TITLE",
                message="A title is required for events and closures.",
                field="title",
            )
        )

    berth = session.get(Berth, proposal.berth_id)
    if berth is not None and not berth.is_active:
        errors.append(
            Issue(
                code="BERTH_INACTIVE",
                message=f'"{berth.name}" is inactive and cannot be booked.',
                field="berth_id",
            )
        )

    vessel: Vessel | None = None
    if proposal.kind == BookingKind.vessel and proposal.vessel_id is not None:
        vessel = session.get(Vessel, proposal.vessel_id)

        if vessel is not None and vessel.loa_ft is None:
            errors.append(
                Issue(
                    code="VESSEL_LENGTH_UNKNOWN",
                    message=(
                        f"{_vessel_label(vessel)} has no recorded length. "
                        "Add its length on the vessel page before booking it."
                    ),
                    field="vessel_id",
                )
            )

        if berth is not None and berth.length_ft is None:
            errors.append(
                Issue(
                    code="BERTH_LENGTH_UNKNOWN",
                    message=f'"{berth.name}" has no recorded length.',
                    field="berth_id",
                )
            )

        if (
            vessel is not None
            and vessel.loa_ft is not None
            and berth is not None
            and berth.length_ft is not None
        ):
            required_ft = float(vessel.loa_ft) + settings.fit_margin_ft
            spare_ft = float(berth.length_ft) - required_ft
            if spare_ft < 0:
                errors.append(
                    Issue(
                        code="VESSEL_TOO_LONG",
                        message=(
                            f"{_vessel_label(vessel)} is {_format_feet(vessel.loa_ft)}; "
                            f'"{berth.name}" is {_format_feet(berth.length_ft)}.'
                        ),
                        field="berth_id",
                    )
                )
            elif spare_ft < settings.tight_fit_ft:
                warnings.append(
                    Issue(
                        code="TIGHT_FIT",
                        message=(
                            f"{_vessel_label(vessel)} ({_format_feet(vessel.loa_ft)}) fits "
                            f'"{berth.name}" ({_format_feet(berth.length_ft)}) with only '
                            f"{_format_feet(spare_ft)} to spare."
                        ),
                        field="berth_id",
                    )
                )

        if (
            vessel is not None
            and vessel.draft_ft is not None
            and berth is not None
            and berth.max_draft_ft is not None
            and float(vessel.draft_ft) > float(berth.max_draft_ft)
        ):
            warnings.append(
                Issue(
                    code="DRAFT_EXCEEDS_DEPTH",
                    message=(
                        f"{_vessel_label(vessel)} draft ({_format_feet(vessel.draft_ft)}) exceeds "
                        f'"{berth.name}" max draft ({_format_feet(berth.max_draft_ft)}).'
                    ),
                    field="berth_id",
                )
            )

    if dates_valid and proposal.status in BLOCKING_STATUSES:
        overlap_expr = func.daterange(Booking.start_date, Booking.end_date, "[]").op("&&")(
            func.daterange(proposal.start_date, proposal.end_date, "[]")
        )
        stmt = select(Booking).where(
            Booking.berth_id == proposal.berth_id,
            Booking.status.in_(BLOCKING_STATUSES),
            overlap_expr,
        )
        if exclude_booking_id is not None:
            stmt = stmt.where(Booking.id != exclude_booking_id)

        for conflict in session.scalars(stmt).all():
            errors.append(
                Issue(
                    code="OVERLAP",
                    message=(
                        f'Conflicts with booking #{conflict.id} "{_booking_label(conflict)}" '
                        f"({_format_date_range(conflict.start_date, conflict.end_date)})."
                    ),
                    field="start_date",
                    related_booking_id=conflict.id,
                )
            )

    # A vessel can't be in two places at once, so this mirrors the OVERLAP
    # check above but keyed on vessel_id instead of berth_id, and across
    # *different* berths specifically (a same-berth clash is already
    # OVERLAP; reporting it again here would just duplicate the message).
    if dates_valid and proposal.status in BLOCKING_STATUSES and proposal.vessel_id is not None:
        vessel_overlap_expr = func.daterange(Booking.start_date, Booking.end_date, "[]").op("&&")(
            func.daterange(proposal.start_date, proposal.end_date, "[]")
        )
        vessel_stmt = select(Booking).where(
            Booking.vessel_id == proposal.vessel_id,
            Booking.berth_id != proposal.berth_id,
            Booking.status.in_(BLOCKING_STATUSES),
            vessel_overlap_expr,
        )
        if exclude_booking_id is not None:
            vessel_stmt = vessel_stmt.where(Booking.id != exclude_booking_id)

        for conflict in session.scalars(vessel_stmt).all():
            errors.append(
                Issue(
                    code="VESSEL_DOUBLE_BOOKED",
                    message=(
                        f'This vessel is already booked on "{conflict.berth.name}" '
                        f"({_format_date_range(conflict.start_date, conflict.end_date)}), "
                        f"booking #{conflict.id}."
                    ),
                    field="vessel_id",
                    related_booking_id=conflict.id,
                )
            )

    if proposal.start_date < date.today():
        warnings.append(
            Issue(
                code="IN_PAST",
                message="Start date is in the past.",
                field="start_date",
            )
        )

    return ValidationResult(ok=len(errors) == 0, errors=errors, warnings=warnings)
