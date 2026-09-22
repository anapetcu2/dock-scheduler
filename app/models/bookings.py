import enum

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.berths import Berth
from app.models.vessels import Vessel


class BookingKind(enum.StrEnum):
    vessel = "vessel"
    event = "event"
    closure = "closure"


class BookingStatus(enum.StrEnum):
    tentative = "tentative"
    confirmed = "confirmed"
    cancelled = "cancelled"
    legacy_conflict = "legacy_conflict"


class BookingSource(enum.StrEnum):
    app = "app"
    import_ = "import"


class Booking(TimestampMixin, Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_bookings_dates"),
        CheckConstraint(
            "(kind = 'vessel' AND vessel_id IS NOT NULL) "
            "OR (kind != 'vessel' AND vessel_id IS NULL)",
            name="ck_bookings_vessel_id_matches_kind",
        ),
        CheckConstraint(
            "(kind != 'vessel' AND title IS NOT NULL) OR (kind = 'vessel')",
            name="ck_bookings_title_required_unless_vessel",
        ),
        Index("ix_bookings_berth_dates", "berth_id", "start_date", "end_date"),
        Index("ix_bookings_vessel_id", "vessel_id"),
        Index("ix_bookings_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    berth_id: Mapped[int] = mapped_column(ForeignKey("berths.id"), nullable=False)
    kind: Mapped[BookingKind] = mapped_column(
        Enum(BookingKind, name="booking_kind", native_enum=True), nullable=False
    )
    vessel_id: Mapped[int | None] = mapped_column(ForeignKey("vessels.id"))
    title: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[Date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Date] = mapped_column(Date, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status", native_enum=True), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)
    source: Mapped[BookingSource] = mapped_column(
        Enum(
            BookingSource,
            name="booking_source",
            native_enum=True,
            values_callable=lambda e: [member.value for member in e],
        ),
        nullable=False,
    )
    source_ref: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    berth: Mapped[Berth] = relationship()
    vessel: Mapped[Vessel | None] = relationship()
