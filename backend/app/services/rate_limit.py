"""Postgres-backed fixed-window rate limiting (works across processes and servers without Redis)."""

import hashlib
import random
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import RateLimitHit


def client_ip(request: Request) -> str:
    """The connecting peer, or, when HARU_TRUST_FORWARDED_FOR is on, the last X-Forwarded-For entry: the one the
    trusted edge wrote. Earlier entries are whatever the client sent (nginx's $proxy_add_x_forwarded_for appends),
    and Next's rewrite adds nothing. Off by default because Next passes a client-supplied header through.
    The server must run with --no-proxy-headers, or uvicorn rewrites request.client from that same header."""
    if get_settings().trust_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[-1].strip()
        if forwarded:
            return forwarded[:64]
    return request.client.host if request.client else "unknown"


def subject_key(kind: str, value: str) -> str:
    """Fixed-length key for user-supplied values (emails up to 254 chars), so it always fits rate_limit_hits.key."""
    return f"{kind}:{hashlib.sha256(value.encode()).hexdigest()[:32]}"


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
