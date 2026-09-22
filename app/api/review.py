from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin, require_user
from app.db import get_db
from app.models.audit import AuditAction
from app.models.import_issues import ImportIssue, ImportIssueType
from app.models.users import User
from app.schemas.review import (
    ImportIssueRead,
    IntegrityIssueRead,
    ResolveImportIssueRequest,
    ReviewSummary,
)
from app.services.audit import record_audit_event
from app.services.integrity import compute_integrity_issues

router = APIRouter(prefix="/review", tags=["review"])


@router.get(
    "/integrity", operation_id="get_integrity_issues", response_model=list[IntegrityIssueRead]
)
def get_integrity_issues(
    db: Session = Depends(get_db), _user: User = Depends(require_user)
) -> list[IntegrityIssueRead]:
    return [IntegrityIssueRead(**vars(issue)) for issue in compute_integrity_issues(db)]


@router.get(
    "/import-issues", operation_id="list_import_issues", response_model=list[ImportIssueRead]
)
def list_import_issues(
    type: ImportIssueType | None = None,
    resolved: bool | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_user),
) -> list[ImportIssue]:
    stmt = select(ImportIssue)
    if type is not None:
        stmt = stmt.where(ImportIssue.issue_type == type)
    if resolved is not None:
        stmt = stmt.where(
            ImportIssue.resolved_at.isnot(None) if resolved else ImportIssue.resolved_at.is_(None)
        )
    stmt = stmt.order_by(ImportIssue.id.desc())
    return db.scalars(stmt).all()


@router.post(
    "/import-issues/{issue_id}/resolve",
    operation_id="resolve_import_issue",
    response_model=ImportIssueRead,
)
def resolve_import_issue(
    issue_id: int,
    body: ResolveImportIssueRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ImportIssue:
    issue = db.get(ImportIssue, issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="Import issue not found")

    issue.resolved_at = datetime.now(UTC)
    issue.resolved_by = admin.id
    issue.resolution_note = body.note

    record_audit_event(
        db,
        user_id=admin.id,
        action=AuditAction.resolve_issue,
        entity_type="import_issue",
        entity_id=issue.id,
        before={"resolved_at": None},
        after={"resolved_at": issue.resolved_at.isoformat(), "resolution_note": body.note},
    )

    db.commit()
    db.refresh(issue)
    return issue


@router.get("/summary", operation_id="get_review_summary", response_model=ReviewSummary)
def get_review_summary(
    db: Session = Depends(get_db), _user: User = Depends(require_user)
) -> ReviewSummary:
    issues = compute_integrity_issues(db)
    counts: dict[str, int] = {}
    for issue in issues:
        counts[issue.code] = counts.get(issue.code, 0) + 1

    unresolved = db.scalar(
        select(func.count()).select_from(ImportIssue).where(ImportIssue.resolved_at.is_(None))
    )

    return ReviewSummary(
        historical_double_bookings=counts.get("HISTORICAL_OVERLAP", 0),
        vessels_too_long=counts.get("VESSEL_TOO_LONG", 0),
        vessels_unknown_length=counts.get("VESSEL_LENGTH_UNKNOWN", 0),
        berths_unknown_length=counts.get("BERTH_LENGTH_UNKNOWN", 0),
        unresolved_import_issues=unresolved or 0,
    )
