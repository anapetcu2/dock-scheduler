from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user
from app.db import get_db
from app.models.contacts import Contact
from app.models.users import User
from app.schemas.contacts import ContactCreate, ContactRead, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])


def _get_or_404(db: Session, contact_id: int) -> Contact:
    contact = db.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return contact


@router.get("", operation_id="list_contacts", response_model=list[ContactRead])
def list_contacts(
    db: Session = Depends(get_db), _user: User = Depends(require_user)
) -> list[Contact]:
    return db.scalars(select(Contact).order_by(Contact.name.asc())).all()


@router.get("/{contact_id}", operation_id="get_contact", response_model=ContactRead)
def get_contact(
    contact_id: int, db: Session = Depends(get_db), _user: User = Depends(require_user)
) -> Contact:
    return _get_or_404(db, contact_id)


@router.post(
    "",
    operation_id="create_contact",
    response_model=ContactRead,
    status_code=status.HTTP_201_CREATED,
)
def create_contact(
    body: ContactCreate, db: Session = Depends(get_db), _user: User = Depends(require_user)
) -> Contact:
    contact = Contact(**body.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.patch("/{contact_id}", operation_id="update_contact", response_model=ContactRead)
def update_contact(
    contact_id: int,
    body: ContactUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_user),
) -> Contact:
    contact = _get_or_404(db, contact_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact
