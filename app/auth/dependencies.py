from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.session import COOKIE_NAME, read_session_token
from app.db import get_db
from app.models.users import User, UserRole


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    data = read_session_token(token)
    if data is None:
        return None
    user = db.get(User, data["user_id"])
    if user is None or not user.is_active:
        return None
    return user


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user
