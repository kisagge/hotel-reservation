import os
from pathlib import Path

# Point the app at the test database before anything imports app.core.db.
os.environ["HARU_DATABASE_URL"] = os.environ.get(
    "HARU_TEST_DATABASE_URL", "postgresql+psycopg://haru:haru@localhost:5433/haru_test"
)

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.core.db import SessionLocal, engine as app_engine
from app.models import Room, RoomSettings

BACKEND_DIR = Path(__file__).resolve().parent.parent
TABLES = "users, rooms, room_photos, room_settings, reservations, payments"


@pytest.fixture(scope="session")
def engine():
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")
    return app_engine


@pytest.fixture
def db(engine):
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def room(db):
    r = Room(id=1, name="스탠다드 더블 · 701호", description="", capacity=2, bed="퀸 베드", size_m2=24, amenities=[])
    db.add(r)
    db.add(RoomSettings(id=1, room_id=1))
    db.commit()
    return r
