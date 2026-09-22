from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.reports import UtilizationRow
from app.services.reports import compute_utilization

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get(
    "/utilization", operation_id="get_utilization_report", response_model=list[UtilizationRow]
)
def get_utilization_report(
    year_from: int, year_to: int, db: Session = Depends(get_db)
) -> list[UtilizationRow]:
    if year_to < year_from:
        raise HTTPException(status_code=422, detail="year_to must be >= year_from")
    return compute_utilization(db, year_from, year_to)
