from pydantic import BaseModel


class Issue(BaseModel):
    code: str
    message: str
    field: str | None = None
    related_booking_id: int | None = None


class ValidationResult(BaseModel):
    ok: bool
    errors: list[Issue] = []
    warnings: list[Issue] = []
