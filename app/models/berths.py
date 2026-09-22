from sqlalchemy import Boolean, Integer, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Berth(TimestampMixin, Base):
    __tablename__ = "berths"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    length_ft: Mapped[float | None] = mapped_column(Numeric(6, 1))
    max_draft_ft: Mapped[float | None] = mapped_column(Numeric(5, 1))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
