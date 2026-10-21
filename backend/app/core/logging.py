"""Structured logging with a per-request ID (JSON lines in prod, readable text in dev)."""

import json
import logging
import re
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

# What a client or edge may pass in X-Request-ID; anything else (spaces, markup, huge values) is replaced.
SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")
_STANDARD = set(vars(logging.LogRecord("", 0, "", 0, "", None, None))) | {"message", "asctime"}


def request_id_from(header: str | None) -> str:
    return header if header and SAFE_REQUEST_ID.fullmatch(header) else uuid.uuid4().hex


class RequestIdFilter(logging.Filter):
    """Stamps every record with the current request's ID (contextvars follow requests into worker threads)."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = request_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    """One JSON object per line: ts, level, logger, msg, plus any `extra=` fields."""

    def format(self, record: logging.LogRecord) -> str:
        out = {"ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
               "level": record.levelname, "logger": record.name, "msg": record.getMessage()}
        out.update({k: v for k, v in vars(record).items() if k not in _STANDARD})
        if record.exc_info:
            out["exc"] = self.formatException(record.exc_info)
        return json.dumps(out, ensure_ascii=False, default=str)


def configure_logging(settings) -> logging.Handler:
    """Attach one handler to the "haru" logger tree (idempotent across create_app calls)."""
    use_json = settings.log_format == "json" if settings.log_format else settings.environment == "prod"
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter() if use_json else logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"))
    handler.addFilter(RequestIdFilter())
    logger = logging.getLogger("haru")
    for old in [h for h in logger.handlers if getattr(h, "_haru", False)]:
        logger.removeHandler(old)
    handler._haru = True
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return handler
