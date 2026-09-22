"""'Find me a berth' (SPEC.md section 8.5).

Reuses `validate_booking` for the overlap check in both call shapes:
- a real vessel (`vessel_id`) runs a `kind=vessel` proposal through it, which
  gives both the overlap and fit checks in one call.
- a hypothetical vessel (`loa_ft` only, no vessel row to check) runs a
  `kind=event` proposal instead, since events skip the fit check and only
  test whether the berth is free; fit against `loa_ft` is then computed here
  with the same formula `booking_rules` uses, since there's no vessel entity
  for `validate_booking` to load. Recorded in DECISIONS.md.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.berths import Berth
from app.models.bookings import Booking, BookingKind, BookingStatus
from app.models.vessels import Vessel
from app.schemas.availability import BerthAvailability, ConflictingBooking
from app.services.booking_rules import BookingProposal, validate_booking


@dataclass(frozen=True)
class AvailabilityQuery:
    start_date: date
    end_date: date
    vessel_id: int | None = None
    loa_ft: float | None = None


def _conflicts_for(session: Session, result_errors, berth_id: int) -> list[ConflictingBooking]:
    ids = [issue.related_booking_id for issue in result_errors if issue.related_booking_id]
    if not ids:
        return []
    bookings = session.scalars(select(Booking).where(Booking.id.in_(ids))).all()
    out = []
    for b in bookings:
        title = b.title or (b.vessel.name if b.vessel else f"booking #{b.id}")
        out.append(
            ConflictingBooking(id=b.id, title=title, start_date=b.start_date, end_date=b.end_date)
        )
    return out


def _fit_for_loa(berth: Berth, loa_ft: float) -> tuple[bool, str, float | None]:
    settings = get_settings()
    if berth.length_ft is None:
        return False, f'"{berth.name}" has no recorded length.', None
    spare = float(berth.length_ft) - (loa_ft + settings.fit_margin_ft)
    if spare < 0:
        return False, f'{loa_ft:g}′ is too long for "{berth.name}" ({berth.length_ft:g}′).', spare
    if spare < settings.tight_fit_ft:
        return True, f"Fits with only {spare:g}′ to spare.", spare
    return True, "Fits.", spare


def check_availability(session: Session, query: AvailabilityQuery) -> list[BerthAvailability]:
    vessel: Vessel | None = None
    if query.vessel_id is not None:
        vessel = session.get(Vessel, query.vessel_id)

    berths = session.scalars(
        select(Berth)
        .where(Berth.is_active.is_(True))
        .order_by(Berth.length_ft.asc().nulls_last(), Berth.sort_order.asc())
    ).all()

    out: list[BerthAvailability] = []
    for berth in berths:
        if vessel is not None:
            proposal = BookingProposal(
                berth_id=berth.id,
                kind=BookingKind.vessel,
                vessel_id=vessel.id,
                start_date=query.start_date,
                end_date=query.end_date,
                status=BookingStatus.confirmed,
            )
            result = validate_booking(session, proposal)
            fit_codes = {"VESSEL_TOO_LONG", "BERTH_LENGTH_UNKNOWN", "VESSEL_LENGTH_UNKNOWN"}
            fit_errors = [e for e in result.errors if e.code in fit_codes]
            overlap_errors = [e for e in result.errors if e.code == "OVERLAP"]
            fits = len(fit_errors) == 0
            fit_reason = fit_errors[0].message if fit_errors else "Fits."
            spare_ft = (
                float(berth.length_ft) - float(vessel.loa_ft) - get_settings().fit_margin_ft
                if fits and berth.length_ft is not None and vessel.loa_ft is not None
                else None
            )
            free = len(overlap_errors) == 0
            conflicts = _conflicts_for(session, overlap_errors, berth.id)
            warnings = result.warnings
        else:
            loa_ft = query.loa_ft or 0.0
            fits, fit_reason, spare_ft = _fit_for_loa(berth, loa_ft)
            proposal = BookingProposal(
                berth_id=berth.id,
                kind=BookingKind.event,
                title="availability check",
                start_date=query.start_date,
                end_date=query.end_date,
                status=BookingStatus.confirmed,
            )
            result = validate_booking(session, proposal)
            overlap_errors = [e for e in result.errors if e.code == "OVERLAP"]
            free = len(overlap_errors) == 0
            conflicts = _conflicts_for(session, overlap_errors, berth.id)
            warnings = result.warnings

        out.append(
            BerthAvailability(
                berth_id=berth.id,
                berth_name=berth.name,
                length_ft=berth.length_ft,
                fits=fits,
                fit_reason=fit_reason,
                free=free,
                spare_ft=spare_ft,
                conflicts=conflicts,
                warnings=warnings,
            )
        )

    def _rank(r: BerthAvailability) -> int:
        if r.fits and r.free:
            return 0
        if r.fits:
            return 1
        return 2

    out.sort(key=_rank)
    return out
