from pydantic import BaseModel


class ContactCreate(BaseModel):
    name: str
    organization_id: int | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None


class ContactUpdate(BaseModel):
    name: str | None = None
    organization_id: int | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None


class ContactRead(BaseModel):
    id: int
    name: str
    organization_id: int | None
    phone: str | None
    email: str | None
    notes: str | None

    model_config = {"from_attributes": True}
