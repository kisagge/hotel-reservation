import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime

import pytest
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.clock import kst
from app.core.db import SessionLocal
from app.models import Reservation

D23, D24 = date(2026, 10, 23), date(2026, 10, 24)


def make(start: datetime, end: datetime, blocked: datetime, status: str = "CONFIRMED") -> Reservation:
    return Reservation(room_id=1, type="DAYUSE", status=status, start_at=start, end_at=end,
                       blocked_until=blocked, guest_name="테스트", total_price=35000)


def insert(db, *args, **kw) -> Reservation:
    r = make(*args, **kw)
    db.add(r)
    db.commit()
    return r


def test_overlap_rejected(db, room):
    insert(db, kst(D23, 15), kst(D23, 19), kst(D23, 20))
    with pytest.raises(IntegrityError) as e:
        insert(db, kst(D23, 18), kst(D23, 22), kst(D23, 23))
    assert e.value.orig.sqlstate == "23P01"


def test_touching_buffer_allowed(db, room):
    insert(db, kst(D23, 10), kst(D23, 14), kst(D23, 15))
    insert(db, kst(D23, 15), kst(D24, 11), kst(D24, 12))


def test_cancelled_does_not_block(db, room):
    insert(db, kst(D23, 15), kst(D23, 19), kst(D23, 20), status="CANCELLED")
    insert(db, kst(D23, 15), kst(D23, 19), kst(D23, 20))


def test_concurrent_inserts_one_wins(db, room):
    barrier = threading.Barrier(2)

    def attempt() -> str:
        with SessionLocal() as s:
            s.add(make(kst(D23, 15), kst(D23, 19), kst(D23, 20)))
            barrier.wait()
            try:
                s.commit()
                return "ok"
            except IntegrityError as e:
                assert e.orig.sqlstate == "23P01"
                return "conflict"
            except OperationalError as e:  # simultaneous exclusion checks may deadlock instead
                assert e.orig.sqlstate == "40P01"
                return "conflict"

    with ThreadPoolExecutor(2) as pool:
        results = sorted(pool.map(lambda _: attempt(), range(2)))
    assert results == ["conflict", "ok"]
