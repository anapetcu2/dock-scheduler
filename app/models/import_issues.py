import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ImportIssueType(enum.StrEnum):
    LAYOUT_MISMATCH = "LAYOUT_MISMATCH"
    ORPHAN_FILL = "ORPHAN_FILL"
    AMBIGUOUS_BOUNDARY = "AMBIGUOUS_BOUNDARY"
    UNLABELED_ROW_ENTRY = "UNLABELED_ROW_ENTRY"
    UNATTACHED_NOTE = "UNATTACHED_NOTE"
    CONFLICTING_VESSEL_LENGTH = "CONFLICTING_VESSEL_LENGTH"
    UNKNOWN_BERTH_LENGTH = "UNKNOWN_BERTH_LENGTH"
    UNKNOWN_BERTH = "UNKNOWN_BERTH"
    NAME_VARIANTS_MERGED = "NAME_VARIANTS_MERGED"
    HISTORICAL_OVERLAP = "HISTORICAL_OVERLAP"


class ImportIssueSeverity(enum.StrEnum):
    error = "error"
    warning = "warning"
    info = "info"


class ImportIssue(TimestampMixin, Base):
    __tablename__ = "import_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_type: Mapped[ImportIssueType] = mapped_column(
        Enum(ImportIssueType, name="import_issue_type", native_enum=True), nullable=False
    )
    severity: Mapped[ImportIssueSeverity] = mapped_column(
        Enum(ImportIssueSeverity, name="import_issue_severity", native_enum=True),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    source_ref: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict | None] = mapped_column(JSONB)
    entity_type: Mapped[str | None] = mapped_column(Text)
    entity_id: Mapped[int | None] = mapped_column(Integer)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolution_note: Mapped[str | None] = mapped_column(Text)
