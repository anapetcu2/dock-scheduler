from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_user
from app.auth.security import verify_password
from app.auth.session import COOKIE_NAME, cookie_kwargs, create_session_token
from app.db import get_db
from app.models.users import User
from app.schemas.auth import LoginRequest, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", operation_id="login", response_model=UserRead)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    token = create_session_token(user_id=user.id, role=user.role.value)
    response.set_cookie(COOKIE_NAME, token, **cookie_kwargs())
    return user


@router.post("/logout", operation_id="logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, _user: User = Depends(get_current_user)) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me", operation_id="get_current_user", response_model=UserRead)
def me(user: User = Depends(require_user)) -> User:
    return user
