"""Connection budget: per-process pool must stay well under Postgres max_connections when many workers run."""

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError, TimeoutError as PoolTimeout

from app.core.config import Settings, get_settings
from app.core.db import get_db, make_engine
from app.main import create_app


def test_pool_is_bounded_by_settings():
    engine = make_engine(Settings(db_pool_size=3, db_max_overflow=2, db_pool_timeout=7))
    assert engine.pool.size() == 3
    assert engine.pool._max_overflow == 2
    assert engine.pool._timeout == 7


def test_default_budget_fits_eight_workers_under_100_connections():
    s = Settings()
    assert 8 * (s.db_pool_size + s.db_max_overflow) <= 80


def _app_with_db_error(exc: Exception) -> TestClient:
    app = create_app()

    def broken_db():
        raise exc
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = broken_db
    return TestClient(app, raise_server_exceptions=False)


def test_pool_exhaustion_is_503_with_retry_after():
    res = _app_with_db_error(PoolTimeout("QueuePool limit reached")).get("/api/room")
    assert res.status_code == 503
    assert res.json() == {"detail": "SERVICE_BUSY"}
    assert res.headers["retry-after"] == "1"


def test_database_refusing_connections_is_503():
    exc = OperationalError("connect", {}, Exception('FATAL:  sorry, too many clients already'))
    res = _app_with_db_error(exc).get("/api/room")
    assert res.status_code == 503
    assert res.json() == {"detail": "SERVICE_BUSY"}


# ---- the session must give its connection back without needing a worker thread -------------------------------
import asyncio
import time

import anyio
import httpx
import pytest
from sqlalchemy.orm import sessionmaker

from app.core import db as db_module


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_threadpool_larger_than_pool_does_not_stall(room, monkeypatch):
    """Sync yield-dependencies need a worker thread to run cleanup. If every thread is blocked waiting for a pooled
    connection, finished requests can never return theirs: the process stalls until pool_timeout (seen under load)."""
    small = dict(db_pool_size=1, db_max_overflow=0, db_pool_timeout=2)
    for k, v in small.items():
        monkeypatch.setattr(get_settings(), k, v)  # the slot gate and the pool come from the same settings
    tiny = db_module.make_engine(Settings(database_url=db_module.engine.url.render_as_string(hide_password=False), **small))
    monkeypatch.setattr(db_module, "SessionLocal", sessionmaker(bind=tiny, expire_on_commit=False))
    limiter = anyio.to_thread.current_default_thread_limiter()
    old_tokens, limiter.total_tokens = limiter.total_tokens, 3
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app()), base_url="http://t") as client:
            t = time.perf_counter()
            res = await asyncio.gather(*[client.get("/api/room") for _ in range(12)])
            elapsed = time.perf_counter() - t
    finally:
        limiter.total_tokens = old_tokens
        tiny.dispose()
    assert [r.status_code for r in res] == [200] * 12
    assert elapsed < 2, f"stalled for {elapsed:.1f}s"
