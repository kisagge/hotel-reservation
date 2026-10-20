"""Idempotent demo data: `uv run python -m app.seed`.

Demo reservations are placed relative to today (KST) so the dashboard always has something to show.
"""

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import KST, get_now, kst, today_kst
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.domain.rules import Quote, quote_dayuse, quote_stay
from app.models import Payment, Reservation, Room, RoomSettings, User
from app.services.reservations import ROOM_ID

ADMIN = ("admin@haru.dev", "admin1234", "관리자", "010-0000-0000")
DEMO = ("haru@example.com", "haru1234", "김하루", "010-1234-5678")


def ensure_user(db: Session, email: str, password: str, name: str, phone: str, role: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, password_hash=hash_password(password), name=name, phone=phone, role=role)
        db.add(user)
        db.flush()
    return user


def ensure_room(db: Session) -> None:
    if db.get(Room, ROOM_ID) is None:
        db.add(Room(id=ROOM_ID, name="스탠다드 더블 · 701호",
                    description="낮에는 대실, 밤에는 숙박. 단 하나의 방을 온전히 당신에게.",
                    capacity=2, bed="퀸 베드", size_m2=24,
                    amenities=["와이파이", "스마트TV", "욕조", "커피머신", "무료주차"]))
        db.add(RoomSettings(id=1, room_id=ROOM_ID))
        db.flush()


def add_booking(db: Session, user: User | None, kind: str, quote: Quote, guest: tuple[str, str],
                cancelled: bool = False) -> None:
    w = quote.window
    r = Reservation(room_id=ROOM_ID, user_id=user.id if user else None, type=kind, start_at=w.start_at,
                    end_at=w.end_at, blocked_until=w.blocked_until, nights=quote.nights, guest_name=guest[0],
                    guest_phone=guest[1], total_price=quote.total,
                    cancel_deadline_at=w.start_at - timedelta(hours=24),
                    status="CANCELLED" if cancelled else "CONFIRMED")
    if cancelled:
        r.cancelled_at, r.cancelled_by = w.start_at - timedelta(days=2), "GUEST"
    db.add(r)
    db.flush()
    r.code = f"HR-{w.start_at.astimezone(KST):%m%d}-{r.id:04d}"
    db.add(Payment(reservation_id=r.id, provider="MOCK", amount=quote.total,
                   status="REFUNDED" if cancelled else "PAID", refunded_at=r.cancelled_at))


def seed_reservations(db: Session, demo: User) -> None:
    if db.scalar(select(func.count()).select_from(Reservation)):
        return
    rules = db.scalar(select(RoomSettings).where(RoomSettings.room_id == ROOM_ID)).to_rules()
    t = today_kst(get_now())
    d = lambda n: t + timedelta(days=n)
    add_booking(db, None, "DAYUSE", quote_dayuse(d(-16), 13, rules), ("오세훈", "010-5555-1111"))
    add_booking(db, demo, "STAY", quote_stay(d(-29), 1, rules), DEMO[2:], cancelled=True)
    add_booking(db, None, "STAY", quote_stay(d(-1), 1, rules), ("김민수", "010-3333-2222"))
    add_booking(db, None, "DAYUSE", quote_dayuse(d(0), 12, rules), ("이서연", "010-7777-8888"))
    add_booking(db, None, "STAY", quote_stay(d(1), 1, rules), ("박준호", "010-4444-9999"))
    add_booking(db, None, "DAYUSE", quote_dayuse(d(4), 10, rules), ("최유진", "010-1212-3434"))
    add_booking(db, demo, "DAYUSE", quote_dayuse(d(4), 15, rules), DEMO[2:])
    add_booking(db, None, "STAY", quote_stay(d(5), 1, rules), ("정다은", "010-5656-7878"))
    add_booking(db, demo, "STAY", quote_stay(d(19), 1, rules), DEMO[2:])
    db.add(Reservation(room_id=ROOM_ID, type="BLOCK", start_at=kst(d(8)), end_at=kst(d(10)),
                       blocked_until=kst(d(10)), block_reason="정기 점검 · 에어컨 필터 교체"))


def main() -> None:
    if get_settings().environment == "prod":  # demo accounts (admin@haru.dev / admin1234) must never reach prod
        raise SystemExit("refusing to seed demo data in prod (unset HARU_SEED)")
    with SessionLocal() as db:
        ensure_user(db, *ADMIN, role="ADMIN")
        demo = ensure_user(db, *DEMO, role="USER")
        ensure_room(db)
        seed_reservations(db, demo)
        db.commit()
        counts = {m.__tablename__: db.scalar(select(func.count()).select_from(m)) for m in (User, Room, Reservation)}
    print(f"seeded: {counts}")


if __name__ == "__main__":
    main()
