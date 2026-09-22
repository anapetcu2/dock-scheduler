from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditAction, AuditEvent


def record_audit_event(
    session: Session,
    *,
    user_id: int | None,
    action: AuditAction,
    entity_type: str,
    entity_id: int,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
) -> AuditEvent:
    """Add an audit row to `session` without committing.

    Callers are expected to be inside the same transaction as the change
    being audited, so a rollback undoes both together.
    """
    event = AuditEvent(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before=before,
        after=after,
    )
    session.add(event)
    return event
