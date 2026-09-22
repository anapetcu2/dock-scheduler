from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.db import get_db
from app.models.berths import Berth
from app.models.users import User
from app.schemas.berths import BerthCreate, BerthRead, BerthUpdate

router = APIRouter(prefix="/berths", tags=["berths"])


def _get_or_404(db: Session, berth_id: int) -> Berth:
    berth = db.get(Berth, berth_id)
    if berth is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Berth not found")
    return berth


@router.get("", operation_id="list_berths", response_model=list[BerthRead])
def list_berths(include_inactive: bool = False, db: Session = Depends(get_db)) -> list[Berth]:
    stmt = select(Berth).order_by(Berth.sort_order.asc())
    if not include_inactive:
        stmt = stmt.where(Berth.is_active.is_(True))
    return db.scalars(stmt).all()


@router.post(
    "",
    operation_id="create_berth",
    response_model=BerthRead,
    status_code=status.HTTP_201_CREATED,
)
def create_berth(
    body: BerthCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
) -> Berth:
    berth = Berth(**body.model_dump())
    db.add(berth)
    db.commit()
    db.refresh(berth)
    return berth


@router.patch("/{berth_id}", operation_id="update_berth", response_model=BerthRead)
def update_berth(
    berth_id: int,
    body: BerthUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Berth:
    berth = _get_or_404(db, berth_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(berth, field, value)
    db.commit()
    db.refresh(berth)
    return berth
