from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, TimeoutError as PoolTimeout
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, public, reservations
from app.services.reservations import ServiceBusy
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="HARU API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(OverflowError)
    async def date_out_of_range(_: Request, __: OverflowError) -> JSONResponse:
        # date + timedelta past year 9999 (e.g. ?date=9999-12-31) is bad input, not a server error
        return JSONResponse({"detail": "DATE_OUT_OF_RANGE"}, status_code=422)

    def busy(_: Request, __: Exception) -> JSONResponse:
        # Pool exhausted or the database refusing connections: tell clients to retry instead of a bare 500.
        return JSONResponse({"detail": "SERVICE_BUSY"}, status_code=503, headers={"Retry-After": "1"})

    app.add_exception_handler(PoolTimeout, busy)
    app.add_exception_handler(ServiceBusy, busy)

    @app.exception_handler(OperationalError)
    async def db_unavailable(request: Request, exc: OperationalError) -> JSONResponse:
        if "too many clients" in str(exc.orig) or "connection failed" in str(exc.orig):
            return busy(request, exc)
        raise exc

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(public.router)
    app.include_router(reservations.router)
    app.include_router(admin.router)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
    return app


app = create_app()
