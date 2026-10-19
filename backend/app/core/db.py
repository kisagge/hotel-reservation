import asyncio
import weakref
from collections.abc import AsyncIterator

from sqlalchemy import create_engine
from sqlalchemy.exc import TimeoutError as PoolTimeout
from sqlalchemy.orm import Session, sessionmaker

from sqlalchemy.engine import Engine

from app.core.config import Settings, get_settings


def make_engine(s: Settings) -> Engine:
    """Bounded pool: excess requests wait for a connection instead of opening new ones past the DB limit."""
    return create_engine(s.database_url, pool_pre_ping=True, pool_size=s.db_pool_size,
                         max_overflow=s.db_max_overflow, pool_timeout=s.db_pool_timeout)


engine = make_engine(get_settings())
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


_slots: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Semaphore]" = weakref.WeakKeyDictionary()


def _db_slots() -> asyncio.Semaphore:
    """One permit per pooled connection, per event loop (a uvicorn worker has one loop; tests may have several)."""
    loop = asyncio.get_running_loop()
    if loop not in _slots:
        s = get_settings()
        _slots[loop] = asyncio.Semaphore(s.db_pool_size + s.db_max_overflow)
    return _slots[loop]


async def get_db() -> AsyncIterator[Session]:
    """Reserve a connection slot on the event loop *before* the request takes a worker thread.

    Sync endpoints, their sync dependencies and FastAPI's response serialization all need threadpool threads. If
    threads could block waiting for a pooled connection, a request that already holds one could not get a thread
    to finish, and the whole process would stall until pool_timeout (observed under load). With this gate a thread
    only ever runs a request that is guaranteed a connection; waiting happens asynchronously, and past
    db_pool_timeout the request gets a retryable 503 (SQLAlchemy TimeoutError handler)."""
    slots = _db_slots()
    try:
        await asyncio.wait_for(slots.acquire(), timeout=get_settings().db_pool_timeout)
    except TimeoutError as e:
        raise PoolTimeout("no database connection slot available") from e
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        slots.release()
