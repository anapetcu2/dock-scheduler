from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.availability import BerthAvailability
from app.services.availability import AvailabilityQuery, check_availability

router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("", operation_id="check_availability", response_model=list[BerthAvailability])
def get_availability(
    start: date,
    end: date,
    vessel_id: int | None = None,
    loa_ft: float | None = None,
    db: Session = Depends(get_db),
) -> list[BerthAvailability]:
    if vessel_id is None and loa_ft is None:
        raise HTTPException(
            status_code=422,
            detail="Provide either vessel_id or loa_ft",
        )
    query = AvailabilityQuery(start_date=start, end_date=end, vessel_id=vessel_id, loa_ft=loa_ft)
    return check_availability(db, query)
