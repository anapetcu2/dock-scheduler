from fastapi import APIRouter

from app.api import (
    auth,
    availability,
    berths,
    bookings,
    contacts,
    health,
    organizations,
    reports,
    review,
    vessels,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(berths.router)
api_router.include_router(organizations.router)
api_router.include_router(contacts.router)
api_router.include_router(vessels.router)
api_router.include_router(bookings.router)
api_router.include_router(availability.router)
api_router.include_router(review.router)
api_router.include_router(reports.router)

__all__ = ["api_router"]
