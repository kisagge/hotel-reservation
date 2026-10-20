from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from sqlalchemy import select

from app.core.clock import kst
from app.models import Payment, RoomSettings
from tests.conftest import book

D23, D24 = date(2026, 10, 23), date(2026, 10, 24)
GUEST_INFO = {"guest_name": "김하루", "guest_phone": "010-1234-5678"}
DAYUSE_23_15 = {"type": "DAYUSE", "date": "2026-10-23", "start_hour": 15, **GUEST_INFO}


def test_create_dayuse_returns_code_and_payment(user_client, db):
    res = user_client.post("/api/reservations", json=DAYUSE_23_15)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["code"] == "HR-1023-0001"
    assert body["total_price"] == 35000
    assert body["status"] == "CONFIRMED"
    assert body["display_status"] == "CONFIRMED"
    assert body["blocked_until"] == "2026-10-23T20:00:00+09:00"
    assert body["can_cancel"] is True
    payment = db.scalar(select(Payment).where(Payment.reservation_id == body["id"]))
    assert payment.status == "PAID" and payment.amount == 35000 and payment.provider == "MOCK"


def test_create_stay(user_client):
    res = user_client.post("/api/reservations", json={"type": "STAY", "check_in": "2026-10-23", "nights": 2,
                                                       **GUEST_INFO})
    assert res.status_code == 201
    assert res.json()["total_price"] == 178000
    assert res.json()["nights"] == 2


def test_create_requires_login_401(client):
    assert client.post("/api/reservations", json=DAYUSE_23_15).status_code == 401


def test_overlap_returns_409(user_client):
    assert user_client.post("/api/reservations", json=DAYUSE_23_15).status_code == 201
    res = user_client.post("/api/reservations", json={**DAYUSE_23_15, "start_hour": 17})
    assert res.status_code == 409
    assert res.json()["detail"] == "SLOT_UNAVAILABLE"


def test_concurrent_create_one_409(user_client, make_client):
    other = make_client()
    other.cookies.update(user_client.cookies)
    with ThreadPoolExecutor(2) as pool:
        codes = sorted(pool.map(lambda c: c.post("/api/reservations", json=DAYUSE_23_15).status_code,
                                [user_client, other]))
    assert codes == [201, 409]


def test_multi_night_create_rejected(user_client, db):
    db.get(RoomSettings, 1).dayuse_hours = 2
    db.commit()
    book(db, kst(D24, 12), kst(D24, 14), kst(D24, 15))
    res = user_client.post("/api/reservations", json={"type": "STAY", "check_in": "2026-10-23", "nights": 2,
                                                       **GUEST_INFO})
    assert res.status_code == 409


def test_create_in_the_past_409(user_client):
    res = user_client.post("/api/reservations", json={**DAYUSE_23_15, "date": "2026-10-18"})
    assert res.status_code == 409
    assert res.json()["detail"] == "IN_THE_PAST"


def test_my_reservations_only_mine(user_client, make_client):
    user_client.post("/api/reservations", json=DAYUSE_23_15)
    other = make_client()
    other.post("/api/auth/signup", json={"email": "b@example.com", "password": "password123", "name": "B",
                                         "phone": "010-2222-3333"})
    assert len(user_client.get("/api/reservations/me").json()) == 1
    assert other.get("/api/reservations/me").json() == []


def test_cancel_other_users_reservation_404(user_client, make_client):
    rid = user_client.post("/api/reservations", json=DAYUSE_23_15).json()["id"]
    other = make_client()
    other.post("/api/auth/signup", json={"email": "b@example.com", "password": "password123", "name": "B",
                                         "phone": "010-2222-3333"})
    assert other.post(f"/api/reservations/{rid}/cancel").status_code == 404


def test_cancel_at_exact_deadline_ok(user_client, clock):
    rid = user_client.post("/api/reservations", json=DAYUSE_23_15).json()["id"]
    clock.set(kst(date(2026, 10, 22), 15))
    res = user_client.post(f"/api/reservations/{rid}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] == "CANCELLED"


def test_cancel_one_second_late_409(user_client, clock):
    rid = user_client.post("/api/reservations", json=DAYUSE_23_15).json()["id"]
    clock.set(kst(date(2026, 10, 22), 15) + timedelta(seconds=1))
    res = user_client.post(f"/api/reservations/{rid}/cancel")
    assert res.status_code == 409
    assert res.json()["detail"] == "CANCEL_DEADLINE_PASSED"


def test_cancel_twice_409(user_client):
    rid = user_client.post("/api/reservations", json=DAYUSE_23_15).json()["id"]
    user_client.post(f"/api/reservations/{rid}/cancel")
    res = user_client.post(f"/api/reservations/{rid}/cancel")
    assert res.status_code == 409
    assert res.json()["detail"] == "ALREADY_CANCELLED"


def test_cancel_frees_slot(user_client, db):
    first = user_client.post("/api/reservations", json=DAYUSE_23_15).json()["id"]
    user_client.post(f"/api/reservations/{first}/cancel")
    assert user_client.post("/api/reservations", json=DAYUSE_23_15).status_code == 201
    payment = db.scalar(select(Payment).where(Payment.reservation_id == first))
    assert payment.status == "REFUNDED"
    assert payment.refunded_at is not None


def test_display_status_completed(user_client, clock):
    user_client.post("/api/reservations", json=DAYUSE_23_15)
    clock.set(kst(D23, 20))
    item = user_client.get("/api/reservations/me").json()[0]
    assert item["display_status"] == "COMPLETED"
    assert item["can_cancel"] is False


def test_many_concurrent_creates_never_500(user_client, make_client):
    """Review: 3+ simultaneous submits used to deadlock twice and leak a 500."""
    clients = [user_client] + [make_client() for _ in range(4)]
    for c in clients[1:]:
        c.cookies.update(user_client.cookies)
    for day in range(23, 28):
        body = {**DAYUSE_23_15, "date": f"2026-10-{day}"}
        with ThreadPoolExecutor(len(clients)) as pool:
            codes = sorted(pool.map(lambda c: c.post("/api/reservations", json=body).status_code, clients))
        assert codes == [201, 409, 409, 409, 409], f"day {day}: {codes}"


def test_concurrent_cancels_refund_once(user_client, make_client, db):
    """Review minor: cancels must lock the row so a reservation is refunded exactly once."""
    rid = user_client.post("/api/reservations", json=DAYUSE_23_15).json()["id"]
    clients = [user_client] + [make_client() for _ in range(4)]
    for c in clients[1:]:
        c.cookies.update(user_client.cookies)
    with ThreadPoolExecutor(len(clients)) as pool:
        codes = sorted(pool.map(lambda c: c.post(f"/api/reservations/{rid}/cancel").status_code, clients))
    assert codes == [200, 409, 409, 409, 409]


def test_huge_ids_are_404_not_500(user_client):
    assert user_client.post("/api/reservations/1099511627776/cancel").status_code in (404, 422)


def test_far_future_dates_are_422_not_500(client):
    res = client.post("/api/quotes", json={"type": "STAY", "check_in": "9999-12-30", "nights": 2})
    assert res.status_code == 422
    assert client.get("/api/availability/dayuse", params={"date": "9999-12-31"}).status_code == 422


# ---- contention: the room lock must never be what a doomed request waits on ----------------------------------
import time as _time

from sqlalchemy import text as _text

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.domain.rules import RuleSettings


def _hold_day_lock(day):
    """Another server holding the write lock for one KST day (same keys the service uses)."""
    from app.services import reservations as svc_mod
    s = SessionLocal()
    for room, ordinal in svc_mod.day_lock_keys(kst(day), kst(day) + timedelta(hours=1)):
        s.execute(_text("SELECT pg_advisory_xact_lock(:r, :o)"), {"r": room, "o": ordinal})
    return s  # caller must rollback/close


def _hold_room_lock():
    return _hold_day_lock(D23)


def test_taken_slot_fails_fast_without_waiting_for_the_room_lock(user_client, db):
    book(db, kst(D23, 15), kst(D23, 19), kst(D23, 20))
    holder = _hold_room_lock()
    try:
        t = _time.perf_counter()
        res = user_client.post("/api/reservations", json=DAYUSE_23_15)
        assert res.status_code == 409
        assert _time.perf_counter() - t < 0.5
    finally:
        holder.rollback(); holder.close()


def test_lock_wait_is_capped_and_retryable(user_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "booking_lock_timeout_ms", 200)
    holder = _hold_room_lock()
    try:
        t = _time.perf_counter()
        res = user_client.post("/api/reservations", json=DAYUSE_23_15)
        assert res.status_code == 503
        assert res.json()["detail"] == "SERVICE_BUSY"
        assert _time.perf_counter() - t < 2
    finally:
        holder.rollback(); holder.close()
    assert user_client.post("/api/reservations", json=DAYUSE_23_15).status_code == 201  # nothing half-written


def test_one_booking_uses_one_settings_snapshot(user_client, monkeypatch):
    """If an admin edits settings mid-booking, price/buffer and cancel deadline must still come from the same read."""
    from app.services import reservations as svc_mod
    reads = iter([RuleSettings(guest_cancel_deadline_hours=24), RuleSettings(guest_cancel_deadline_hours=72)] * 5)
    monkeypatch.setattr(svc_mod, "load_rules", lambda db: next(reads))
    body = user_client.post("/api/reservations", json=DAYUSE_23_15).json()
    assert body["cancel_deadline_at"] == "2026-10-22T15:00:00+09:00"


def test_other_days_are_not_blocked_by_a_busy_day(user_client):
    holder = _hold_day_lock(D23)
    try:
        t = _time.perf_counter()
        res = user_client.post("/api/reservations", json={**DAYUSE_23_15, "date": "2026-10-26"})
        assert res.status_code == 201
        assert _time.perf_counter() - t < 0.5
    finally:
        holder.rollback(); holder.close()


def test_a_stay_spanning_a_busy_day_waits_for_it(user_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "booking_lock_timeout_ms", 200)
    holder = _hold_day_lock(D24)  # 10/23 15:00 → 10/25 11:00 crosses 10/24
    try:
        res = user_client.post("/api/reservations", json={"type": "STAY", "check_in": "2026-10-23", "nights": 2, **GUEST_INFO})
        assert res.status_code == 503
    finally:
        holder.rollback(); holder.close()


def test_day_lock_keys_cover_every_touched_kst_date_in_order():
    from app.services import reservations as svc_mod
    keys = svc_mod.day_lock_keys(kst(D23, 15), kst(date(2026, 10, 25), 12))
    assert [o for _, o in keys] == sorted(o for _, o in keys) and len(keys) == 3


def test_create_beyond_horizon_is_422(user_client):
    res = user_client.post("/api/reservations", json={**DAYUSE_23_15, "date": "2027-10-21"})
    assert res.status_code == 422 and res.json()["detail"] == "DATE_OUT_OF_RANGE"
