from datetime import date

from app.core.clock import kst
from app.models import RoomSettings
from tests.conftest import book

D23, D24 = date(2026, 10, 23), date(2026, 10, 24)


def test_room_includes_rules(client):
    res = client.get("/api/room")
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "스탠다드 더블 · 701호"
    assert body["rules"]["dayuse_weekday_price"] == 35000
    assert body["rules"]["stay_check_in_hour"] == 15


def test_dayuse_availability_reflects_reservation(client, db):
    book(db, kst(D23, 10), kst(D23, 14), kst(D23, 15))
    res = client.get("/api/availability/dayuse", params={"date": "2026-10-23"})
    assert res.status_code == 200
    a = {s["start_hour"]: s["available"] for s in res.json()["slots"]}
    assert not any(a[h] for h in range(10, 15))
    assert a[15] is True


def test_stay_availability_month_length(client):
    res = client.get("/api/availability/stay", params={"month": "2026-10"})
    assert res.status_code == 200
    assert len(res.json()["days"]) == 31


def test_stay_availability_bad_month_422(client):
    assert client.get("/api/availability/stay", params={"month": "2026-13"}).status_code == 422


def test_quote_stay_total(client):
    res = client.post("/api/quotes", json={"type": "STAY", "check_in": "2026-10-23", "nights": 2})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 178000
    assert body["available"] is True
    assert body["reason"] is None
    assert body["start_at"] == "2026-10-23T15:00:00+09:00"
    assert body["end_at"] == "2026-10-25T11:00:00+09:00"


def test_quote_dayuse_hour_out_of_range_422(client):
    res = client.post("/api/quotes", json={"type": "DAYUSE", "date": "2026-10-23", "start_hour": 21})
    assert res.status_code == 422
    assert res.json()["detail"] == "START_HOUR_OUT_OF_RANGE"


def test_quote_in_the_past(client):
    res = client.post("/api/quotes", json={"type": "DAYUSE", "date": "2026-10-18", "start_hour": 15})
    assert res.json()["available"] is False
    assert res.json()["reason"] == "IN_THE_PAST"


def test_quote_multi_night_rejects_midday_dayuse(client, db):
    db.get(RoomSettings, 1).dayuse_hours = 2
    db.commit()
    book(db, kst(D24, 12), kst(D24, 14), kst(D24, 15))
    one = lambda d: client.post("/api/quotes", json={"type": "STAY", "check_in": d, "nights": 1}).json()
    assert one("2026-10-23")["available"] is True
    assert one("2026-10-24")["available"] is True
    two = client.post("/api/quotes", json={"type": "STAY", "check_in": "2026-10-23", "nights": 2}).json()
    assert two["available"] is False
    assert two["reason"] == "SLOT_UNAVAILABLE"


def test_dayuse_today_at_kst_midnight(client, clock):
    clock.set(kst(date(2026, 10, 19), 0, 30))
    res = client.get("/api/availability/dayuse", params={"date": "2026-10-19"})
    a = {s["start_hour"]: s["available"] for s in res.json()["slots"]}
    assert a[10] is True


def test_booking_horizon_is_enforced(client):
    """Beyond booking_horizon_days (365) nothing is bookable: quotes are 422, availability shows no open slots."""
    far = "2027-10-21"  # today (2026-10-19) + 367 days
    res = client.post("/api/quotes", json={"type": "DAYUSE", "date": far, "start_hour": 15})
    assert res.status_code == 422 and res.json()["detail"] == "DATE_OUT_OF_RANGE"
    slots = client.get("/api/availability/dayuse", params={"date": far}).json()["slots"]
    assert not any(s["available"] for s in slots)
    ok = client.post("/api/quotes", json={"type": "DAYUSE", "date": "2027-10-18", "start_hour": 15})
    assert ok.status_code == 200
