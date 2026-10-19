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
