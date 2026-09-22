import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, require_admin, require_user
from app.db import get_db
from app.models.audit import AuditEvent
from app.models.berths import Berth
from app.models.bookings import Booking, BookingKind, BookingStatus
from app.models.users import User
from app.models.vessels import Vessel
from app.schemas.bookings import (
    AuditEventRead,
    BookingCreate,
    BookingDetail,
    BookingRead,
    BookingUpdate,
    BookingValidateRequest,
)
from app.schemas.validation import ValidationResult
from app.services.booking_rules import BookingProposal, validate_booking
from app.services.bookings import (
    BookingInput,
    cancel_booking,
    create_booking,
    delete_booking,
    update_booking,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])

# Booking statuses that can only be changed by an admin, per SPEC.md section 6:
# cancelled bookings can't be edited except by admins, and legacy_conflict
# bookings are moved out of that state by admins specifically.
ADMIN_ONLY_EDIT_STATUSES = (BookingStatus.cancelled, BookingStatus.legacy_conflict)


def _get_or_404(db: Session, booking_id: int) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


def _to_read(booking: Booking) -> BookingRead:
    return BookingRead(
        id=booking.id,
        berth_id=booking.berth_id,
        berth_name=booking.berth.name,
        kind=booking.kind,
        vessel_id=booking.vessel_id,
        vessel_name=booking.vessel.name if booking.vessel else None,
        vessel_loa_ft=booking.vessel.loa_ft if booking.vessel else None,
        title=booking.title,
        start_date=booking.start_date,
        end_date=booking.end_date,
        status=booking.status,
        notes=booking.notes,
        source=booking.source,
        source_ref=booking.source_ref,
        created_by=booking.created_by,
        created_at=booking.created_at,
        updated_at=booking.updated_at,
    )


@router.get("", operation_id="list_bookings", response_model=list[BookingRead])
def list_bookings(
    start: str | None = None,
    end: str | None = None,
    berth_id: int | None = None,
    vessel_id: int | None = None,
    kind: BookingKind | None = None,
    status: BookingStatus | None = None,
    db: Session = Depends(get_db),
) -> list[BookingRead]:
    stmt = select(Booking).options(joinedload(Booking.berth), joinedload(Booking.vessel))

    if status is not None:
        stmt = stmt.where(Booking.status == status)
    else:
        stmt = stmt.where(Booking.status != BookingStatus.cancelled)

    if start is not None:
        stmt = stmt.where(Booking.end_date >= start)
    if end is not None:
        stmt = stmt.where(Booking.start_date <= end)
    if berth_id is not None:
        stmt = stmt.where(Booking.berth_id == berth_id)
    if vessel_id is not None:
        stmt = stmt.where(Booking.vessel_id == vessel_id)
    if kind is not None:
        stmt = stmt.where(Booking.kind == kind)

    stmt = stmt.order_by(Booking.start_date.asc())
    bookings = db.scalars(stmt).unique().all()
    return [_to_read(b) for b in bookings]


@router.get("/export.csv", operation_id="export_bookings_csv")
def export_bookings_csv(
    start: str | None = None,
    end: str | None = None,
    berth_id: int | None = None,
    vessel_id: int | None = None,
    kind: BookingKind | None = None,
    status: BookingStatus | None = None,
    db: Session = Depends(get_db),
) -> Response:
    rows = list_bookings(
        start=start,
        end=end,
        berth_id=berth_id,
        vessel_id=vessel_id,
        kind=kind,
        status=status,
        db=db,
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["id", "berth", "kind", "vessel", "title", "start_date", "end_date", "status", "notes"]
    )
    for b in rows:
        writer.writerow(
            [
                b.id,
                b.berth_name,
                b.kind.value,
                b.vessel_name or "",
                b.title or "",
                b.start_date.isoformat(),
                b.end_date.isoformat(),
                b.status.value,
                b.notes or "",
            ]
        )
    return Response(content=buf.getvalue(), media_type="text/csv")


@router.get("/{booking_id}", operation_id="get_booking", response_model=BookingDetail)
def get_booking(
    booking_id: int, db: Session = Depends(get_db), user: User | None = Depends(get_current_user)
) -> BookingDetail:
    booking = _get_or_404(db, booking_id)
    history: list[AuditEventRead] = []
    if user is not None:
        events = db.scalars(
            select(AuditEvent)
            .where(AuditEvent.entity_type == "booking", AuditEvent.entity_id == booking_id)
            .order_by(AuditEvent.at.desc())
        ).all()
        history = [AuditEventRead.model_validate(e) for e in events]
    return BookingDetail(**_to_read(booking).model_dump(), audit_history=history)


@router.post("/validate", operation_id="validate_booking", response_model=ValidationResult)
def validate_booking_endpoint(
    body: BookingValidateRequest, db: Session = Depends(get_db)
) -> ValidationResult:
    proposal = BookingProposal(
        berth_id=body.berth_id,
        kind=body.kind,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
        vessel_id=body.vessel_id,
        title=body.title,
    )
    return validate_booking(db, proposal, exclude_booking_id=body.booking_id)


def _require_berth_and_vessel(db: Session, berth_id: int, vessel_id: int | None) -> None:
    if db.get(Berth, berth_id) is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Berth not found")
    if vessel_id is not None and db.get(Vessel, vessel_id) is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Vessel not found")


@router.post(
    "",
    operation_id="create_booking",
    response_model=BookingRead,
    status_code=http_status.HTTP_201_CREATED,
)
def create_booking_endpoint(
    body: BookingCreate, db: Session = Depends(get_db), user: User = Depends(require_user)
) -> BookingRead:
    _require_berth_and_vessel(db, body.berth_id, body.vessel_id)
    data = BookingInput(**body.model_dump())
    booking = create_booking(db, data, created_by=user.id)
    db.commit()
    db.refresh(booking)
    return _to_read(booking)


@router.patch("/{booking_id}", operation_id="update_booking", response_model=BookingRead)
def update_booking_endpoint(
    booking_id: int,
    body: BookingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> BookingRead:
    booking = _get_or_404(db, booking_id)
    if booking.status in ADMIN_ONLY_EDIT_STATUSES and user.role.value != "admin":
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=f"Only an admin can edit a {booking.status.value} booking",
        )

    current = BookingInput(
        berth_id=booking.berth_id,
        kind=booking.kind,
        start_date=booking.start_date,
        end_date=booking.end_date,
        status=booking.status,
        vessel_id=booking.vessel_id,
        title=booking.title,
        notes=booking.notes,
    )
    updates = body.model_dump(exclude_unset=True)
    merged = BookingInput(**{**current.__dict__, **updates})

    _require_berth_and_vessel(db, merged.berth_id, merged.vessel_id)
    booking = update_booking(db, booking, merged, user_id=user.id)
    db.commit()
    db.refresh(booking)
    return _to_read(booking)


@router.post("/{booking_id}/cancel", operation_id="cancel_booking", response_model=BookingRead)
def cancel_booking_endpoint(
    booking_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)
) -> BookingRead:
    booking = _get_or_404(db, booking_id)
    booking = cancel_booking(db, booking, user_id=user.id)
    db.commit()
    db.refresh(booking)
    return _to_read(booking)


@router.delete(
    "/{booking_id}", operation_id="delete_booking", status_code=http_status.HTTP_204_NO_CONTENT
)
def delete_booking_endpoint(
    booking_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
) -> None:
    booking = _get_or_404(db, booking_id)
    delete_booking(db, booking, user_id=_admin.id)
    db.commit()
