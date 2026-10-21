import logging
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, TimeoutError as PoolTimeout
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, public, reservations
from app.services.reservations import ServiceBusy
from app.core.config import get_settings
from app.core.logging import configure_logging, request_id_from, request_id_var


access_log = logging.getLogger("haru.access")
error_log = logging.getLogger("haru.error")

DEFAULT_SECRET = "dev-only-secret-change-me-in-production-0123456789"


def assert_safe_settings(s) -> None:
    """Refuse to serve production traffic with a guessable signing key (anyone could mint an admin token)."""
    # "change-me" also catches the docker-compose fallback, which is long but published in the repo.
    if s.environment == "prod" and (s.jwt_secret == DEFAULT_SECRET or len(s.jwt_secret) < 32 or "change-me" in s.jwt_secret):
        raise RuntimeError("HARU_JWT_SECRET must be set to a random value of at least 32 characters in prod")


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}


def create_app() -> FastAPI:
    settings = get_settings()
    assert_safe_settings(settings)
    configure_logging(settings)
    app = FastAPI(title="HARU API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        """Request ID + one access log line per request; unhandled errors become a JSON 500 that names the ID.
        Registered before security_headers, so that (outer) middleware still decorates the 500."""
        rid = request_id_from(request.headers.get("x-request-id"))
        token = request_id_var.set(rid)
        started = time.perf_counter()
        try:
            try:
                response = await call_next(request)
            except Exception:
                error_log.exception("unhandled error", extra={"method": request.method, "path": request.url.path})
                response = JSONResponse({"detail": "INTERNAL_ERROR", "request_id": rid}, status_code=500)
            response.headers["X-Request-ID"] = rid
            # Path only: query strings carry search terms and phone numbers.
            access_log.info("%s %s %s", request.method, request.url.path, response.status_code,
                            extra={"method": request.method, "path": request.url.path, "status": response.status_code,
                                   "duration_ms": round((time.perf_counter() - started) * 1000, 1)})
            return response
        finally:
            request_id_var.reset(token)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        for k, v in SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        if request.url.path.startswith("/uploads/"):
            # served user content: never executable, never framed
            response.headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; sandbox"
        return response

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
