from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

VESSEL_TYPE_PREFIXES = (
    "R/V",
    "M/V",
    "F/V",
    "S/V",
    "M/Y",
    "S/Y",
    "Tug",
    "Barge",
    "OSV",
)


class Vessel(TimestampMixin, Base):
    __tablename__ = "vessels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    type_prefix: Mapped[str | None] = mapped_column(Text)
    normalized_key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    loa_ft: Mapped[float | None] = mapped_column(Numeric(6, 1))
    draft_ft: Mapped[float | None] = mapped_column(Numeric(5, 1))
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text)


class VesselContact(TimestampMixin, Base):
    __tablename__ = "vessel_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vessel_id: Mapped[int] = mapped_column(ForeignKey("vessels.id"), nullable=False)
    contact_id: Mapped[int] = mapped_column(ForeignKey("contacts.id"), nullable=False)
    role: Mapped[str | None] = mapped_column(Text)
