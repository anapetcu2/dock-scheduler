from pydantic import BaseModel


class BerthCreate(BaseModel):
    name: str
    length_ft: float | None = None
    max_draft_ft: float | None = None
    is_active: bool = True
    sort_order: int = 0
    notes: str | None = None


class BerthUpdate(BaseModel):
    name: str | None = None
    length_ft: float | None = None
    max_draft_ft: float | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    notes: str | None = None


class BerthRead(BaseModel):
    id: int
    name: str
    length_ft: float | None
    max_draft_ft: float | None
    is_active: bool
    sort_order: int
    notes: str | None

    model_config = {"from_attributes": True}
