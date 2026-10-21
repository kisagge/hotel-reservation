"""Admin walk-in bookings and rescheduling."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from sqlalchemy import select

from app.core.clock import kst
from app.models import Payment, Reservation, RoomSettings
from tests.conftest import book

WALK_IN = {"guest_name": "현장손님", "guest_phone": "010-2222-3333"}
DAYUSE_23_15 = {"type": "DAYUSE", "date": "2026-10-23", "start_hour": 15}
D = lambda day: date(2026, 10, day)


def walk_in(admin_client, slot=DAYUSE_23_15):
    res = admin_client.post("/api/admin/reservations", json={**slot, **WALK_IN})
    assert res.status_code == 201, res.text
    return res.json()


def available(client, slot) -> bool:
    return client.post("/api/quotes", json=slot).json()["available"]


# ---- walk-in ---------------------------------------------------------------------------------------------------
def test_admin_creates_a_walk_in_booking(admin_client, db):
    body = walk_in(admin_client)
    assert body["code"] == "HR-1023-0001" and body["total_price"] == 35000
    assert body["user_email"] is None and body["guest_name"] == "현장손님"
    assert body["payment"]["status"] == "PAID" and body["payment"]["amount"] == 35000
    assert db.get(Reservation, body["id"]).user_id is None
    assert not available(admin_client, DAYUSE_23_15)


def test_walk_in_follows_the_booking_rules(admin_client, user_client):
    walk_in(admin_client)
    post = lambda slot: admin_client.post("/api/admin/reservations", json={**slot, **WALK_IN})
    assert post(DAYUSE_23_15).json()["detail"] == "SLOT_UNAVAILABLE"
    assert post({**DAYUSE_23_15, "date": "2026-10-18"}).json()["detail"] == "IN_THE_PAST"
    assert post({**DAYUSE_23_15, "start_hour": 23}).status_code == 422
    assert user_client.post("/api/admin/reservations", json={**DAYUSE_23_15, **WALK_IN}).status_code == 403


# ---- reschedule ------------------------------------------------------------------------------------------------
def test_reschedule_moves_the_booking_reprices_it_and_frees_the_old_slot(admin_client, db):
    r = walk_in(admin_client)
    new = {"type": "DAYUSE", "date": "2026-10-24", "start_hour": 12}  # Saturday → weekend price
    res = admin_client.post(f"/api/admin/reservations/{r['id']}/reschedule", json=new)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["code"] == r["code"]  # the number the guest already has stays valid
    assert (body["start_at"], body["end_at"]) == ("2026-10-24T12:00:00+09:00", "2026-10-24T16:00:00+09:00")
    assert body["total_price"] == 45000 and body["payment"]["amount"] == 45000
    assert body["cancel_deadline_at"] == "2026-10-23T12:00:00+09:00"
    assert available(admin_client, DAYUSE_23_15)
    assert not available(admin_client, new)


def test_reschedule_may_overlap_only_its_own_old_window(admin_client):
    r = walk_in(admin_client)
    res = admin_client.post(f"/api/admin/reservations/{r['id']}/reschedule", json={**DAYUSE_23_15, "start_hour": 16})
    assert res.status_code == 200
    assert res.json()["start_at"] == "2026-10-23T16:00:00+09:00"


def test_reschedule_onto_another_booking_is_409_and_changes_nothing(admin_client, db):
    r = walk_in(admin_client)
    book(db, kst(D(24), 10), kst(D(24), 14), kst(D(24), 15), guest_name="다른손님")
    res = admin_client.post(f"/api/admin/reservations/{r['id']}/reschedule",
                            json={"type": "DAYUSE", "date": "2026-10-24", "start_hour": 11})
    assert res.status_code == 409 and res.json()["detail"] == "SLOT_UNAVAILABLE"
    db.expire_all()
    assert db.get(Reservation, r["id"]).start_at == kst(D(23), 15)


def test_reschedule_can_change_the_type(admin_client, db):
    r = walk_in(admin_client)
    stay = admin_client.post(f"/api/admin/reservations/{r['id']}/reschedule",
                             json={"type": "STAY", "check_in": "2026-10-25", "nights": 2})
    assert stay.status_code == 200, stay.text
    assert (stay.json()["type"], stay.json()["nights"], stay.json()["total_price"]) == ("STAY", 2, 158000)
    back = admin_client.post(f"/api/admin/reservations/{r['id']}/reschedule", json=DAYUSE_23_15)
    assert (back.json()["type"], back.json()["nights"]) == ("DAYUSE", None)


def test_reschedule_uses_current_settings(admin_client, db):
    r = walk_in(admin_client)
    db.get(RoomSettings, 1).cleaning_buffer_minutes = 120
    db.commit()
    body = admin_client.post(f"/api/admin/reservations/{r['id']}/reschedule", json={**DAYUSE_23_15, "start_hour": 14}).json()
    assert body["blocked_until"] == "2026-10-23T20:00:00+09:00"


def test_cannot_reschedule_cancelled_started_or_blocks(admin_client, db, clock):
    r = walk_in(admin_client)
    target = {**DAYUSE_23_15, "start_hour": 17}
    clock.set(kst(D(23), 15) + timedelta(minutes=1))
    res = admin_client.post(f"/api/admin/reservations/{r['id']}/reschedule", json=target)
    assert res.status_code == 409 and res.json()["detail"] == "RESERVATION_STARTED"
    clock.set(kst(D(19), 9))
    admin_client.post(f"/api/admin/reservations/{r['id']}/cancel")
    res = admin_client.post(f"/api/admin/reservations/{r['id']}/reschedule", json=target)
    assert res.status_code == 409 and res.json()["detail"] == "ALREADY_CANCELLED"
    block = book(db, kst(D(27)), kst(D(28)), kst(D(28)), type="BLOCK", price=0, guest_name="", block_reason="점검")
    assert admin_client.post(f"/api/admin/reservations/{block.id}/reschedule", json=target).status_code == 404


def test_refund_after_reschedule_returns_the_new_amount(admin_client, db):
    r = walk_in(admin_client)
    admin_client.post(f"/api/admin/reservations/{r['id']}/reschedule", json={"type": "DAYUSE", "date": "2026-10-24", "start_hour": 12})
    admin_client.post(f"/api/admin/reservations/{r['id']}/cancel")
    p = db.scalar(select(Payment).where(Payment.reservation_id == r["id"]))
    db.refresh(p)
    assert (p.status, p.amount) == ("REFUNDED", 45000)


def test_reschedule_racing_a_guest_booking_for_the_same_slot(admin_client, user_client):
    r = walk_in(admin_client)
    target = {"type": "DAYUSE", "date": "2026-10-24", "start_hour": 12}
    guest_info = {"guest_name": "김하루", "guest_phone": "010-1234-5678"}
    calls = [lambda: admin_client.post(f"/api/admin/reservations/{r['id']}/reschedule", json=target).status_code,
             lambda: user_client.post("/api/reservations", json={**target, **guest_info}).status_code]
    with ThreadPoolExecutor(2) as pool:
        codes = sorted(pool.map(lambda f: f(), calls))
    assert codes in ([200, 409], [201, 409])


def test_cancel_racing_a_reschedule_leaves_a_consistent_row(admin_client, make_client, db):
    for i in range(5):  # a few rounds: the interleaving differs from run to run
        slot = {"type": "DAYUSE", "date": f"2026-10-{23 + i}", "start_hour": 10}
        r = walk_in(admin_client, slot)
        other = make_client()
        other.cookies.update(admin_client.cookies)
        calls = [lambda: admin_client.post(f"/api/admin/reservations/{r['id']}/cancel").status_code,
                 lambda: other.post(f"/api/admin/reservations/{r['id']}/reschedule", json={**slot, "start_hour": 16}).status_code]
        with ThreadPoolExecutor(2) as pool:
            cancel_code, move_code = pool.map(lambda f: f(), calls)
        assert cancel_code == 200 and move_code in (200, 409)
        db.expire_all()
        row = db.get(Reservation, r["id"])
        assert row.status == "CANCELLED"
        assert (row.payment.status, row.payment.amount) == ("REFUNDED", row.total_price)
