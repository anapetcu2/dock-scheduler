from pydantic import BaseModel


class UtilizationRow(BaseModel):
    berth_id: int
    berth_name: str
    year: int
    days_booked: int
    tentative_days: int
    total_days_in_year: int
    percent_occupied: float

    model_config = {"from_attributes": True}
