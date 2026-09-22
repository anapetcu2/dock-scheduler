from datetime import date

from pydantic import BaseModel

from app.schemas.validation import Issue


class ConflictingBooking(BaseModel):
    id: int
    title: str
    start_date: date
    end_date: date


class BerthAvailability(BaseModel):
    berth_id: int
    berth_name: str
    length_ft: float | None
    fits: bool
    fit_reason: str
    free: bool
    spare_ft: float | None = None
    conflicts: list[ConflictingBooking] = []
    warnings: list[Issue] = []
