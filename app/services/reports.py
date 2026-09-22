"""Utilization report (SPEC.md section 8.6): days booked per berth per
year. Confirmed and legacy_conflict bookings count as "booked"; tentative
bookings are reported separately, since a hold isn't the same as a
confirmed use of the berth even though it blocks new bookings.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.berths import Berth
from app.models.bookings import Booking, BookingStatus


@dataclass(frozen=True)
class BerthYearUtilization:
    berth_id: int
    berth_name: str
    year: int
    days_booked: int
    tentative_days: int
    total_days_in_year: int
    percent_occupied: float


def _days_in_year(year: int) -> int:
    return (date(year, 12, 31) - date(year, 1, 1)).days + 1


def _clipped_days(start: date, end: date, year: int) -> int:
    clipped_start = max(start, date(year, 1, 1))
    clipped_end = min(end, date(year, 12, 31))
    return max(0, (clipped_end - clipped_start).days + 1)


def compute_utilization(
    session: Session, year_from: int, year_to: int
) -> list[BerthYearUtilization]:
    berths = session.scalars(select(Berth).order_by(Berth.sort_order)).all()

    range_start = date(year_from, 1, 1)
    range_end = date(year_to, 12, 31)
    bookings = session.scalars(
        select(Booking).where(
            Booking.status != BookingStatus.cancelled,
            Booking.start_date <= range_end,
            Booking.end_date >= range_start,
        )
    ).all()

    booked: dict[tuple[int, int], int] = defaultdict(int)
    tentative: dict[tuple[int, int], int] = defaultdict(int)

    for booking in bookings:
        start_year = max(year_from, booking.start_date.year)
        end_year = min(year_to, booking.end_date.year)
        bucket = tentative if booking.status == BookingStatus.tentative else booked
        for year in range(start_year, end_year + 1):
            days = _clipped_days(booking.start_date, booking.end_date, year)
            if days:
                bucket[(booking.berth_id, year)] += days

    rows: list[BerthYearUtilization] = []
    for berth in berths:
        for year in range(year_from, year_to + 1):
            total_days = _days_in_year(year)
            days_booked = booked.get((berth.id, year), 0)
            rows.append(
                BerthYearUtilization(
                    berth_id=berth.id,
                    berth_name=berth.name,
                    year=year,
                    days_booked=days_booked,
                    tentative_days=tentative.get((berth.id, year), 0),
                    total_days_in_year=total_days,
                    percent_occupied=round(100 * days_booked / total_days, 1),
                )
            )
    return rows
