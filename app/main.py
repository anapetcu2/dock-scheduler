"""FastAPI app: JSON API under /api, plus the built React app.

In development, Vite serves the frontend on its own port and proxies /api to
this app. In production (Vercel), frontend/dist is built first and served
from here so the whole thing is one deployable app (see SPEC.md section 2).
"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

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

if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str) -> FileResponse:
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
