from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user
from app.db import get_db
from app.models.bookings import Booking, BookingStatus
from app.models.contacts import Contact
from app.models.users import User
from app.models.vessels import Vessel, VesselContact
from app.schemas.vessels import (
    VesselBookingSummary,
    VesselCreate,
    VesselDetail,
    VesselRead,
    VesselUpdate,
)
from app.services.vessels import normalize_vessel_key

router = APIRouter(prefix="/vessels", tags=["vessels"])


def _get_or_404(db: Session, vessel_id: int) -> Vessel:
    vessel = db.get(Vessel, vessel_id)
    if vessel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vessel not found")
    return vessel


def _booked_vessel_ids_since(cutoff: date):
    """A subquery of vessel ids with at least one non-cancelled booking
    ending on or after `cutoff` — used to split "recent" from "historical"
    vessels on the list page, since importing 23 years of history makes
    the plain vessel list unusably long otherwise."""
    return select(Booking.vessel_id).where(
        Booking.vessel_id.isnot(None),
        Booking.status != BookingStatus.cancelled,
        Booking.end_date >= cutoff,
    )


@router.get("", operation_id="list_vessels", response_model=list[VesselRead])
def list_vessels(
    q: str | None = None,
    include_inactive: bool = False,
    used_since: date | None = None,
    used_before: date | None = None,
    db: Session = Depends(get_db),
) -> list[Vessel]:
    stmt = select(Vessel).order_by(Vessel.name.asc())
    if not include_inactive:
        stmt = stmt.where(Vessel.is_active.is_(True))
    if q:
        needle = f"%{q.strip().upper()}%"
        stmt = stmt.where(Vessel.normalized_key.ilike(needle) | Vessel.name.ilike(f"%{q}%"))
    if used_since is not None:
        stmt = stmt.where(Vessel.id.in_(_booked_vessel_ids_since(used_since)))
    if used_before is not None:
        stmt = stmt.where(Vessel.id.notin_(_booked_vessel_ids_since(used_before)))
    return db.scalars(stmt).all()


@router.get("/{vessel_id}", operation_id="get_vessel", response_model=VesselDetail)
def get_vessel(vessel_id: int, db: Session = Depends(get_db)) -> VesselDetail:
    vessel = _get_or_404(db, vessel_id)

    contact_rows = db.scalars(
        select(Contact)
        .join(VesselContact, VesselContact.contact_id == Contact.id)
        .where(VesselContact.vessel_id == vessel_id)
    ).all()

    bookings = db.scalars(
        select(Booking)
        .where(Booking.vessel_id == vessel_id, Booking.status != BookingStatus.cancelled)
        .order_by(Booking.start_date.desc())
    ).all()

    today = date.today()
    upcoming = [b for b in bookings if b.end_date >= today]
    past = [b for b in bookings if b.end_date < today]

    def _summary(b: Booking) -> VesselBookingSummary:
        return VesselBookingSummary(
            id=b.id,
            berth_id=b.berth_id,
            berth_name=b.berth.name,
            start_date=b.start_date,
            end_date=b.end_date,
            status=b.status.value,
        )

    return VesselDetail(
        **VesselRead.model_validate(vessel).model_dump(),
        contacts=list(contact_rows),
        upcoming_bookings=[_summary(b) for b in upcoming],
        past_bookings=[_summary(b) for b in past],
    )


@router.post(
    "",
    operation_id="create_vessel",
    response_model=VesselRead,
    status_code=status.HTTP_201_CREATED,
)
def create_vessel(
    body: VesselCreate, db: Session = Depends(get_db), _user: User = Depends(require_user)
) -> Vessel:
    normalized_key = normalize_vessel_key(body.type_prefix, body.name)
    existing = db.scalar(select(Vessel).where(Vessel.normalized_key == normalized_key))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "A vessel with this name already exists", "vessel_id": existing.id},
        )

    vessel = Vessel(**body.model_dump(), normalized_key=normalized_key)
    db.add(vessel)
    db.commit()
    db.refresh(vessel)
    return vessel


@router.patch("/{vessel_id}", operation_id="update_vessel", response_model=VesselRead)
def update_vessel(
    vessel_id: int,
    body: VesselUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_user),
) -> Vessel:
    vessel = _get_or_404(db, vessel_id)
    updates = body.model_dump(exclude_unset=True)

    new_name = updates.get("name", vessel.name)
    new_prefix = updates.get("type_prefix", vessel.type_prefix)
    normalized_key = normalize_vessel_key(new_prefix, new_name)
    if normalized_key != vessel.normalized_key:
        existing = db.scalar(
            select(Vessel).where(Vessel.normalized_key == normalized_key, Vessel.id != vessel_id)
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "A vessel with this name already exists",
                    "vessel_id": existing.id,
                },
            )

    for field, value in updates.items():
        setattr(vessel, field, value)
    vessel.normalized_key = normalized_key

    db.commit()
    db.refresh(vessel)
    return vessel
