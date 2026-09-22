from pydantic import BaseModel


class OrganizationCreate(BaseModel):
    name: str
    notes: str | None = None


class OrganizationUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None


class OrganizationRead(BaseModel):
    id: int
    name: str
    notes: str | None

    model_config = {"from_attributes": True}
