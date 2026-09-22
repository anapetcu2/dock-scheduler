"""FastAPI app: JSON API under /api, plus the built React app.

In development, Vite serves the frontend on its own port and proxies /api to
this app. In production (Vercel), frontend/dist is built first and served
from here so the whole thing is one deployable app (see SPEC.md section 2).
"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api import api_router
from app.services.exceptions import BookingConflictError, BookingValidationError

app = FastAPI(title="Dock Scheduler API")

app.include_router(api_router, prefix="/api")


@app.exception_handler(BookingValidationError)
def handle_booking_validation_error(_request: Request, exc: BookingValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content=exc.result.model_dump())


@app.exception_handler(BookingConflictError)
def handle_booking_conflict_error(_request: Request, exc: BookingConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content=exc.result.model_dump())


FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

# Vercel builds frontend/dist via vercel.json's buildCommand before this
# module is even imported for its build-time static-asset scan, so this is
# always true in production; it's only False in local dev/tests before
# `npm run build` has been run. check_dir=False since we've already done
# the same check ourselves — app.frontend()'s own default check doesn't
# know to skip itself outside of `fastapi dev` (which this project doesn't
# use; see SPEC.md section 2 on the Vite-proxy dev setup).
if FRONTEND_DIST.is_dir():
    app.frontend("/", directory=FRONTEND_DIST, check_dir=False)
