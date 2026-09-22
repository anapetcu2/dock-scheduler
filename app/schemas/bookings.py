from datetime import date, datetime

from pydantic import BaseModel

from app.models.bookings import BookingKind, BookingSource, BookingStatus
from app.schemas.validation import ValidationResult


class BookingCreate(BaseModel):
    berth_id: int
    kind: BookingKind
    start_date: date
    end_date: date
    status: BookingStatus = BookingStatus.confirmed
    vessel_id: int | None = None
    title: str | None = None
    notes: str | None = None


class BookingUpdate(BaseModel):
    """Partial update. The router merges these onto the booking's current
    values before calling the booking rules, per DECISIONS.md."""

    berth_id: int | None = None
    kind: BookingKind | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: BookingStatus | None = None
    vessel_id: int | None = None
    title: str | None = None
    notes: str | None = None


class BookingValidateRequest(BaseModel):
    berth_id: int
    kind: BookingKind
    start_date: date
    end_date: date
    status: BookingStatus = BookingStatus.confirmed
    vessel_id: int | None = None
    title: str | None = None
    booking_id: int | None = None


class BookingRead(BaseModel):
    id: int
    berth_id: int
    berth_name: str
    kind: BookingKind
    vessel_id: int | None
    vessel_name: str | None
    vessel_loa_ft: float | None
    title: str | None
    start_date: date
    end_date: date
    status: BookingStatus
    notes: str | None
    source: BookingSource
    source_ref: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class AuditEventRead(BaseModel):
    id: int
    user_id: int | None
    action: str
    before: dict | None
    after: dict | None
    at: datetime

    model_config = {"from_attributes": True}


class BookingDetail(BookingRead):
    audit_history: list[AuditEventRead] = []


class CancelResponse(BaseModel):
    booking: BookingRead


class BookingErrorResponse(BaseModel):
    """Shape returned on 422 (validation failed) and 409 (race lost)."""

    result: ValidationResult
