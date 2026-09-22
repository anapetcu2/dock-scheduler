"""Signed session cookie: itsdangerous, HttpOnly, SameSite=Lax, Secure in
production. Stores user id and role only (see SPEC.md section 8.1).
"""

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import get_settings

COOKIE_NAME = "session"
MAX_AGE_SECONDS = 7 * 24 * 3600


def _serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.secret_key, salt="dock-scheduler-session")


def create_session_token(*, user_id: int, role: str) -> str:
    return _serializer().dumps({"user_id": user_id, "role": role})


def read_session_token(token: str) -> dict | None:
    try:
        data = _serializer().loads(token, max_age=MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    if not isinstance(data, dict) or "user_id" not in data:
        return None
    return data


def cookie_kwargs() -> dict:
    settings = get_settings()
    return {
        "httponly": True,
        "samesite": "lax",
        "secure": settings.is_production,
        "max_age": MAX_AGE_SECONDS,
        "path": "/",
    }
