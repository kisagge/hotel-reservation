"""DB-level guarantees added in migration 0003: shape/state CHECKs and index-backed hot queries."""

from datetime import date, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.clock import kst
from app.models import Payment, Reservation, RoomSettings, User
from app.services import reservations as svc

D23 = date(2026, 10, 23)


def base(**kw) -> Reservation:
    v = dict(room_id=1, type="DAYUSE", status="CONFIRMED", start_at=kst(D23, 15), end_at=kst(D23, 19),
             blocked_until=kst(D23, 20), guest_name="손님", total_price=35000, cancel_deadline_at=kst(D23 - timedelta(days=1), 15))
    v.update(kw)
    return Reservation(**v)


def rejected(db, obj, constraint: str):
    db.add(obj)
    with pytest.raises(IntegrityError) as e:
        db.commit()
    db.rollback()
    assert constraint in str(e.value.orig)


@pytest.mark.parametrize("kw", [
    dict(type="STAY", nights=None),                       # stay must have nights
    dict(type="DAYUSE", nights=1),                        # day-use has no nights
    dict(cancel_deadline_at=None),                        # bookings snapshot their cancel policy
    dict(guest_name=""),                                  # bookings name a guest
    dict(type="BLOCK", block_reason=None, total_price=0, cancel_deadline_at=None, blocked_until=kst(D23, 19)),
    dict(type="BLOCK", block_reason="점검", total_price=0, cancel_deadline_at=None, blocked_until=kst(D23, 20)),  # blocks get no buffer
])
def test_reservation_shape(db, room, kw):
    rejected(db, base(**kw), "reservations_kind_shape")


def test_cancelled_needs_who_and_when(db, room):
    rejected(db, base(status="CANCELLED"), "reservations_cancel_state")


def test_negative_price_rejected(db, room):
    rejected(db, base(total_price=-1), "reservations_price_nonneg")


def test_refunded_payment_needs_timestamp(db, room):
    r = base()
    db.add(r)
    db.commit()
    rejected(db, Payment(reservation_id=r.id, provider="MOCK", amount=35000, status="REFUNDED"), "payments_refund_state")


def test_email_stored_lowercase(db):
    rejected(db, User(email="Haru@Example.com", password_hash="x", name="n", phone="010-0000-0000"), "users_email_lower")


def test_settings_ranges_enforced(db, room):
    s = db.get(RoomSettings, 1)
    s.stay_check_out_hour, s.cleaning_buffer_minutes = 14, 120  # 14:00 + 2h > 15:00 check-in
    with pytest.raises(IntegrityError) as e:
        db.commit()
    db.rollback()
    assert "room_settings_turnover" in str(e.value.orig)


@pytest.fixture
def bulk(db, room):
    """5k bookings over ~3 years plus 200 users, then ANALYZE, so the planner picks plans as it would in production."""
    conn = db.connection()
    conn.exec_driver_sql("INSERT INTO users (email, password_hash, name, phone) "
                         "SELECT 'u' || g || '@x.com', 'h', 'n' || g, '010' FROM generate_series(1, 200) g")
    conn.exec_driver_sql(
        "INSERT INTO reservations (code, room_id, user_id, type, status, start_at, end_at, blocked_until, guest_name, guest_phone,"
        " total_price, cancel_deadline_at) "
        "SELECT 'HR-' || g, 1, 1 + mod(g, 200), 'DAYUSE', 'CONFIRMED', ts, ts + interval '4 hours', ts + interval '5 hours',"
        " '손님' || g, '010-' || g, 35000, ts - interval '1 day' "
        "FROM (SELECT g, timestamptz '2024-01-01 00:00+09' + g * interval '5 hours' AS ts FROM generate_series(1, 5000) g) s")
    db.commit()
    db.connection().exec_driver_sql("ANALYZE")


def plan(db, stmt, *, forbid_seqscan: bool = False) -> str:
    conn = db.connection()
    if forbid_seqscan:  # small tables legitimately prefer scans; this proves the predicate is trigram-index-compatible
        conn.exec_driver_sql("SET LOCAL enable_seqscan = off")
        conn.exec_driver_sql("SET LOCAL enable_indexscan = off")
    compiled = stmt.compile(dialect=conn.dialect, compile_kwargs={"render_postcompile": True})
    rows = conn.exec_driver_sql("EXPLAIN " + str(compiled), compiled.params).all()
    db.rollback()
    return "\n".join(r[0] for r in rows)


def test_busy_query_uses_overlap_index(db, bulk):
    assert "reservations_no_overlap" in plan(db, svc.busy_query(kst(date(2025, 6, 1)), kst(date(2025, 6, 3))))


def test_my_reservations_uses_user_index(db, bulk):
    assert "ix_reservations_user_start" in plan(db, svc.my_reservations_query(user_id=1))


def test_admin_list_uses_start_index(db, bulk):
    stmt = svc.admin_list_query(date_from=date(2025, 6, 1), date_to=date(2025, 6, 30), type=None, status=None, q=None)
    assert "ix_reservations_start_at" in plan(db, stmt)


def test_admin_search_uses_trigram_index(db, bulk):
    stmt = svc.admin_list_query(date_from=None, date_to=None, type=None, status=None, q="4242")
    assert "ix_reservations_guest_name_trgm" in plan(db, stmt, forbid_seqscan=True)
