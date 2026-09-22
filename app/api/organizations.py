from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user
from app.db import get_db
from app.models.contacts import Organization
from app.models.users import User
from app.schemas.organizations import OrganizationCreate, OrganizationRead, OrganizationUpdate

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _get_or_404(db: Session, org_id: int) -> Organization:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.get("", operation_id="list_organizations", response_model=list[OrganizationRead])
def list_organizations(db: Session = Depends(get_db)) -> list[Organization]:
    return db.scalars(select(Organization).order_by(Organization.name.asc())).all()


@router.get("/{org_id}", operation_id="get_organization", response_model=OrganizationRead)
def get_organization(org_id: int, db: Session = Depends(get_db)) -> Organization:
    return _get_or_404(db, org_id)


@router.post(
    "",
    operation_id="create_organization",
    response_model=OrganizationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_organization(
    body: OrganizationCreate, db: Session = Depends(get_db), _user: User = Depends(require_user)
) -> Organization:
    org = Organization(**body.model_dump())
    db.add(org)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization with this name already exists",
        ) from exc
    db.refresh(org)
    return org


@router.patch("/{org_id}", operation_id="update_organization", response_model=OrganizationRead)
def update_organization(
    org_id: int,
    body: OrganizationUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_user),
) -> Organization:
    org = _get_or_404(db, org_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization with this name already exists",
        ) from exc
    db.refresh(org)
    return org
