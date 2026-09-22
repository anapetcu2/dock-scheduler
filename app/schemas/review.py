from datetime import datetime

from pydantic import BaseModel


class IntegrityIssueRead(BaseModel):
    code: str
    severity: str
    message: str
    booking_id: int | None = None
    vessel_id: int | None = None
    berth_id: int | None = None
    related_booking_id: int | None = None

    model_config = {"from_attributes": True}


class ImportIssueRead(BaseModel):
    id: int
    issue_type: str
    severity: str
    message: str
    source_ref: str | None
    details: dict | None
    entity_type: str | None
    entity_id: int | None
    resolved_at: datetime | None
    resolved_by: int | None
    resolution_note: str | None

    model_config = {"from_attributes": True}


class ResolveImportIssueRequest(BaseModel):
    note: str | None = None


class ReviewSummary(BaseModel):
    historical_double_bookings: int
    vessels_too_long: int
    vessels_unknown_length: int
    berths_unknown_length: int
    unresolved_import_issues: int
