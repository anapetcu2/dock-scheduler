from datetime import date

from pydantic import BaseModel

from app.schemas.contacts import ContactRead


class VesselCreate(BaseModel):
    name: str
    type_prefix: str | None = None
    loa_ft: float | None = None
    draft_ft: float | None = None
    organization_id: int | None = None
    is_active: bool = True
    notes: str | None = None


class VesselUpdate(BaseModel):
    name: str | None = None
    type_prefix: str | None = None
    loa_ft: float | None = None
    draft_ft: float | None = None
    organization_id: int | None = None
    is_active: bool | None = None
    notes: str | None = None


class VesselRead(BaseModel):
    id: int
    name: str
    type_prefix: str | None
    normalized_key: str
    loa_ft: float | None
    draft_ft: float | None
    organization_id: int | None
    is_active: bool
    notes: str | None
    # The end_date of this vessel's most recent non-cancelled booking, or
    # null if it's never been booked. Computed, not stored — see
    # app/api/vessels.py.
    last_booked_date: date | None = None

    model_config = {"from_attributes": True}


class VesselBookingSummary(BaseModel):
    id: int
    berth_id: int
    berth_name: str
    start_date: date
    end_date: date
    status: str


class VesselDetail(VesselRead):
    contacts: list[ContactRead] = []
    upcoming_bookings: list[VesselBookingSummary] = []
    past_bookings: list[VesselBookingSummary] = []


class VesselConflictResponse(BaseModel):
    detail: str
    vessel_id: int
