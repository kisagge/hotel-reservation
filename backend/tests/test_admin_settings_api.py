from datetime import date
from pathlib import Path

import pytest

from app.core.clock import kst
from app.core.config import get_settings
from tests.conftest import book

D = lambda day: date(2026, 10, day)
GUEST_INFO = {"guest_name": "김하루", "guest_phone": "010-1234-5678"}
BLOCK_27_29 = {"start_at": "2026-10-27T00:00:00+09:00", "end_at": "2026-10-29T00:00:00+09:00", "reason": "정기 점검"}


def put_settings(admin_client, **changes):
    current = admin_client.get("/api/admin/settings").json()
    return admin_client.put("/api/admin/settings", json={**current, **changes})


def test_settings_forbidden_for_user(user_client):
    assert user_client.get("/api/admin/settings").status_code == 403


def test_update_prices_affects_quote(admin_client):
    assert put_settings(admin_client, dayuse_weekday_price=40000).status_code == 200
    q = admin_client.post("/api/quotes", json={"type": "DAYUSE", "date": "2026-10-23", "start_hour": 15}).json()
    assert q["total"] == 40000


@pytest.mark.parametrize("changes", [
    {"stay_check_out_hour": 15, "stay_check_in_hour": 15},
    {"dayuse_first_start_hour": 21, "dayuse_last_start_hour": 20},
    {"dayuse_weekday_price": 0},
    {"cleaning_buffer_minutes": 300},
])
def test_invalid_settings_422(admin_client, changes):
    assert put_settings(admin_client, **changes).status_code == 422


def test_buffer_change_keeps_existing_blocked_until(admin_client, user_client):
    first = user_client.post("/api/reservations", json={"type": "DAYUSE", "date": "2026-10-23", "start_hour": 10,
                                                         **GUEST_INFO}).json()
    assert first["blocked_until"] == "2026-10-23T15:00:00+09:00"
    put_settings(admin_client, cleaning_buffer_minutes=120)
    mine = user_client.get("/api/reservations/me").json()
    assert mine[0]["blocked_until"] == "2026-10-23T15:00:00+09:00"
    second = user_client.post("/api/reservations", json={"type": "DAYUSE", "date": "2026-10-23", "start_hour": 16,
                                                          **GUEST_INFO}).json()
    assert second["blocked_until"] == "2026-10-23T22:00:00+09:00"


def test_block_hides_stay_days(admin_client, client):
    res = admin_client.post("/api/admin/blocks", json=BLOCK_27_29)
    assert res.status_code == 201
    assert res.json()["reason"] == "정기 점검"
    days = {d["date"]: d["available"] for d in client.get("/api/availability/stay", params={"month": "2026-10"}).json()["days"]}
    assert days["2026-10-27"] is False and days["2026-10-28"] is False and days["2026-10-29"] is True


def test_block_list_and_delete_frees_days(admin_client, client):
    bid = admin_client.post("/api/admin/blocks", json=BLOCK_27_29).json()["id"]
    assert [b["id"] for b in admin_client.get("/api/admin/blocks").json()] == [bid]
    assert admin_client.delete(f"/api/admin/blocks/{bid}").status_code == 204
    assert admin_client.get("/api/admin/blocks").json() == []
    days = {d["date"]: d["available"] for d in client.get("/api/availability/stay", params={"month": "2026-10"}).json()["days"]}
    assert days["2026-10-27"] is True


def test_block_overlapping_reservation_409(admin_client, db):
    book(db, kst(D(27), 15), kst(D(28), 11), kst(D(28), 12), type="STAY", nights=1, price=79000)
    res = admin_client.post("/api/admin/blocks", json=BLOCK_27_29)
    assert res.status_code == 409
    assert res.json()["detail"] == "BLOCK_OVERLAPS_RESERVATION"


def test_block_end_before_start_422(admin_client):
    bad = {**BLOCK_27_29, "end_at": "2026-10-26T00:00:00+09:00"}
    assert admin_client.post("/api/admin/blocks", json=bad).status_code == 422


def test_update_room_info(admin_client, client):
    body = {"name": "디럭스 더블 · 701호", "description": "조용한 방", "capacity": 2, "bed": "퀸 베드", "size_m2": 26,
            "amenities": ["와이파이", "욕조"]}
    assert admin_client.put("/api/admin/room", json=body).status_code == 200
    room = client.get("/api/room").json()
    assert room["name"] == "디럭스 더블 · 701호" and room["amenities"] == ["와이파이", "욕조"]


def test_photo_upload_and_delete(admin_client, client, tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))
    res = admin_client.post("/api/admin/room/photos", files={"file": ("room.png", b"\x89PNG\r\n\x1a\nfake", "image/png")})
    assert res.status_code == 201
    photo = res.json()
    assert photo["url"].startswith("/uploads/") and photo["url"].endswith(".png")
    stored = tmp_path / Path(photo["url"]).name
    assert stored.exists()
    assert [p["id"] for p in client.get("/api/room").json()["photos"]] == [photo["id"]]
    assert admin_client.delete(f"/api/admin/room/photos/{photo['id']}").status_code == 204
    assert not stored.exists()
    assert client.get("/api/room").json()["photos"] == []


def test_photo_rejects_non_image(admin_client, tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))
    res = admin_client.post("/api/admin/room/photos", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert res.status_code == 422


def test_cancel_deadline_change_keeps_existing_bookings(admin_client, user_client, clock):
    """Review: settings apply to new reservations only — including the guest cancel deadline."""
    first = user_client.post("/api/reservations", json={"type": "DAYUSE", "date": "2026-10-23", "start_hour": 15,
                                                         **GUEST_INFO}).json()
    assert first["cancel_deadline_at"] == "2026-10-22T15:00:00+09:00"
    put_settings(admin_client, guest_cancel_deadline_hours=72)
    second = user_client.post("/api/reservations", json={"type": "DAYUSE", "date": "2026-10-25", "start_hour": 15,
                                                          **GUEST_INFO}).json()
    assert second["cancel_deadline_at"] == "2026-10-22T15:00:00+09:00"
    clock.set(kst(D(21), 12))
    assert user_client.post(f"/api/reservations/{first['id']}/cancel").status_code == 200
