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


# ---- API clients ----------------------------------------------------------
from datetime import date

from fastapi.testclient import TestClient

from app.core.clock import get_now, kst
from app.core.security import hash_password
from app.main import create_app
from app.models import User

DEFAULT_NOW = kst(date(2026, 10, 19), 9)
GUEST = {"email": "guest@example.com", "password": "password123", "name": "김하루", "phone": "010-1234-5678"}
ADMIN = {"email": "admin@haru.dev", "password": "admin1234"}


class Clock:
    def __init__(self):
        self.now = DEFAULT_NOW

    def set(self, dt):
        self.now = dt


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def app(db, room, clock):
    application = create_app()
    application.dependency_overrides[get_now] = lambda: clock.now
    return application


@pytest.fixture
def make_client(app):
    def _make() -> TestClient:
        return TestClient(app)
    return _make


@pytest.fixture
def client(make_client):
    return make_client()


@pytest.fixture
def user_client(make_client):
    c = make_client()
    assert c.post("/api/auth/signup", json=GUEST).status_code == 201
    return c


@pytest.fixture
def admin_client(make_client, db):
    db.add(User(email=ADMIN["email"], password_hash=hash_password(ADMIN["password"]), name="관리자",
                phone="010-0000-0000", role="ADMIN"))
    db.commit()
    c = make_client()
    assert c.post("/api/auth/login", json=ADMIN).status_code == 200
    return c
