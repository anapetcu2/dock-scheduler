from pydantic import BaseModel

from app.models.users import UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class UserRead(BaseModel):
    id: int
    email: str
    name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}
