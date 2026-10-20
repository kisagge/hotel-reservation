"""Postgres-backed fixed-window rate limiting (works across processes and servers without Redis)."""

import random
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import RateLimitHit


def client_ip(request: Request) -> str:
    """The connecting peer, or the first X-Forwarded-For hop when a trusted edge sets it (never by default:
    Next's rewrite passes a client-supplied X-Forwarded-For through unchanged)."""
    if get_settings().trust_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded.strip():
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def hit(db: Session, key: str, limit: int, window_s: int, now: datetime) -> int | None:
    """Count one attempt; return seconds until the window resets if this attempt is over the limit."""
    epoch = int(now.timestamp())
    start = datetime.fromtimestamp(epoch - epoch % window_s, UTC)
    stmt = insert(RateLimitHit).values(key=key, window_start=start, count=1)
    stmt = stmt.on_conflict_do_update(index_elements=["key", "window_start"],
                                      set_={"count": RateLimitHit.count + 1}).returning(RateLimitHit.count)
    count = db.scalar(stmt)
    if random.random() < 0.01:  # opportunistic cleanup of old windows
        db.execute(delete(RateLimitHit).where(RateLimitHit.window_start < now - timedelta(days=1)))
    return None if count <= limit else max(1, int((start + timedelta(seconds=window_s) - now).total_seconds()))


def enforce(db: Session, checks: list[tuple[str, int, int]], now: datetime) -> None:
    """Record every check, commit (so counts persist and the connection is released before slow work), then 429."""
    if not get_settings().rate_limit_enabled:
        return
    waits = [w for key, limit, window in checks if (w := hit(db, key, limit, window, now)) is not None]
    db.commit()
    if waits:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS", headers={"Retry-After": str(max(waits))})
