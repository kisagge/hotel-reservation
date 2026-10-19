"""Reservation persistence and queries. Business rules live in app.domain."""

from datetime import date, datetime, timedelta
from typing import Literal

from sqlalchemy import Select, func, literal, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import KST, kst, today_kst
from app.domain.availability import Busy, overlaps
from app.domain.rules import Quote, RuleSettings, quote_dayuse, quote_stay
from app.models import Payment, Reservation, Room, RoomSettings, User
from app.schemas import QuoteIn
from app.services.payments import PaymentProvider

ROOM_ID = 1
BOOKING_TYPES = ("DAYUSE", "STAY")
OVERLAP_SQLSTATE = "23P01"


class SlotUnavailable(Exception):
    def __init__(self, reason: str = "SLOT_UNAVAILABLE"):
        super().__init__(reason)
        self.reason = reason


class CancelDeadlinePassed(Exception):
    pass


class AlreadyCancelled(Exception):
    pass


class BlockOverlaps(Exception):
    pass


# ---- reads ---------------------------------------------------------------------------------------------------
def load_settings(db: Session) -> RoomSettings:
    return db.scalars(select(RoomSettings).where(RoomSettings.room_id == ROOM_ID)).one()


def load_rules(db: Session) -> RuleSettings:
    return load_settings(db).to_rules()


def occupying(start: datetime, end: datetime) -> tuple:
    """CONFIRMED rows whose [start_at, blocked_until) meets [start, end). Same tstzrange && expression and partial
    predicate as the reservations_no_overlap exclusion constraint, so its GiST index serves the lookup."""
    occupied = func.tstzrange(Reservation.start_at, Reservation.blocked_until, literal("[)"))
    return (Reservation.room_id == ROOM_ID, Reservation.status == "CONFIRMED",
            occupied.op("&&")(func.tstzrange(start, end, literal("[)"))))


def busy_query(start: datetime, end: datetime) -> Select:
    return select(Reservation.start_at, Reservation.blocked_until).where(*occupying(start, end))


def busy_between(db: Session, start: datetime, end: datetime) -> list[Busy]:
    return [(r.start_at, r.blocked_until) for r in db.execute(busy_query(start, end))]


def build_quote(q: QuoteIn, rules: RuleSettings) -> Quote:
    """Raises RuleViolation for inputs outside the configured rules."""
    if q.type == "DAYUSE":
        return quote_dayuse(q.date, q.start_hour, rules)
    return quote_stay(q.check_in, q.nights, rules)


def evaluate_quote(db: Session, q: QuoteIn, now: datetime) -> tuple[Quote, str | None]:
    """Quote plus the reason it cannot be booked right now (None if bookable)."""
    quote = build_quote(q, load_rules(db))
    w = quote.window
    if w.start_at <= now:
        return quote, "IN_THE_PAST"
    if overlaps(w, busy_between(db, w.start_at, w.blocked_until)):
        return quote, "SLOT_UNAVAILABLE"
    return quote, None


def my_reservations_query(user_id: int) -> Select:
    return select(Reservation).where(Reservation.user_id == user_id).order_by(Reservation.start_at, Reservation.id)


def my_reservations(db: Session, user: User) -> list[Reservation]:
    return list(db.scalars(my_reservations_query(user.id)))


def get_for_update(db: Session, reservation_id: int) -> Reservation | None:
    """Row-locked read for state changes, so concurrent cancels serialize and only one refunds."""
    stmt = select(Reservation).where(Reservation.id == reservation_id).with_for_update().execution_options(populate_existing=True)
    return db.scalars(stmt).first()


# ---- commands ------------------------------------------------------------------------------------------------
def is_overlap_error(e: IntegrityError) -> bool:
    return getattr(e.orig, "sqlstate", None) == OVERLAP_SQLSTATE


def lock_room(db: Session) -> None:
    """Serialize occupancy writes for the room until commit. Concurrent inserts racing inside the exclusion
    check deadlock each other (40P01); taking this row lock first means the check never sees two inserters,
    and the quote evaluated after it already sees the winner."""
    db.execute(select(Room.id).where(Room.id == ROOM_ID).with_for_update())


def create_reservation(db: Session, user: User, q: QuoteIn, guest_name: str, guest_phone: str, now: datetime,
                       payments: PaymentProvider) -> Reservation:
    lock_room(db)
    quote, reason = evaluate_quote(db, q, now)
    if reason:
        raise SlotUnavailable(reason)
    w = quote.window
    rules = load_rules(db)
    r = Reservation(room_id=ROOM_ID, user_id=user.id, type=q.type, status="CONFIRMED", start_at=w.start_at,
                    end_at=w.end_at, blocked_until=w.blocked_until, nights=quote.nights, guest_name=guest_name,
                    guest_phone=guest_phone, total_price=quote.total,
                    cancel_deadline_at=w.start_at - timedelta(hours=rules.guest_cancel_deadline_hours))
    db.add(r)
    try:
        db.flush()  # the exclusion constraint stays the backstop
    except IntegrityError as e:
        db.rollback()
        if is_overlap_error(e):
            raise SlotUnavailable() from e
        raise
    r.code = f"HR-{w.start_at.astimezone(KST):%m%d}-{r.id:04d}"
    db.add(Payment(reservation_id=r.id, provider=payments.charge(quote.total), amount=quote.total, status="PAID"))
    db.commit()
    db.refresh(r)
    return r


def guest_can_cancel(r: Reservation, now: datetime) -> bool:
    """Uses the deadline captured at booking time, so later settings changes never apply retroactively."""
    return r.status == "CONFIRMED" and r.cancel_deadline_at is not None and now <= r.cancel_deadline_at


def cancel_reservation(db: Session, r: Reservation, by: Literal["GUEST", "ADMIN"], now: datetime,
                       payments: PaymentProvider) -> Reservation:
    """`r` must come from get_for_update so the status check below sees the committed state."""
    if r.status == "CANCELLED":
        raise AlreadyCancelled()
    allowed = guest_can_cancel(r, now) if by == "GUEST" else now < r.start_at
    if not allowed:
        raise CancelDeadlinePassed()
    r.status, r.cancelled_at, r.cancelled_by = "CANCELLED", now, by
    if r.payment and r.payment.status == "PAID":
        payments.refund(r.payment)
        r.payment.status, r.payment.refunded_at = "REFUNDED", now
    db.commit()
    return r


# ---- admin ---------------------------------------------------------------------------------------------------
def like_contains(q: str) -> str:
    """'%q%' with LIKE wildcards in q taken literally (PostgreSQL's default LIKE escape is backslash)."""
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def admin_list_query(*, date_from: date | None, date_to: date | None, type: str | None, status: str | None,
                     q: str | None) -> Select:
    conds = [Reservation.type.in_(BOOKING_TYPES)]
    if date_from:
        conds.append(Reservation.start_at >= kst(date_from))
    if date_to:
        conds.append(Reservation.start_at < kst(date_to + timedelta(days=1)))
    if type:
        conds.append(Reservation.type == type)
    if status:
        conds.append(Reservation.status == status)
    if q:
        like = like_contains(q)
        conds.append(or_(Reservation.code.ilike(like), Reservation.guest_name.ilike(like), Reservation.guest_phone.ilike(like)))
    # id breaks ties so pages never repeat or skip rows that share a start time
    return select(Reservation).where(*conds).order_by(Reservation.start_at, Reservation.id)


def admin_list(db: Session, *, date_from: date | None, date_to: date | None, type: str | None,
               status: str | None, q: str | None, page: int, size: int) -> tuple[list[Reservation], int]:
    stmt = admin_list_query(date_from=date_from, date_to=date_to, type=type, status=status, q=q)
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = db.scalars(stmt.offset((page - 1) * size).limit(size))
    return list(items), total


def dashboard(db: Session, now: datetime) -> dict:
    today = today_kst(now)
    day_start, day_end = kst(today), kst(today + timedelta(days=1))
    week_start = kst(today - timedelta(days=today.weekday()))
    month_start = kst(today.replace(day=1))
    next_month = kst((today.replace(day=1) + timedelta(days=32)).replace(day=1))
    confirmed = (Reservation.status == "CONFIRMED", Reservation.room_id == ROOM_ID)
    booking = (*confirmed, Reservation.type.in_(BOOKING_TYPES))

    def count(*conds) -> int:
        return db.scalar(select(func.count()).select_from(Reservation).where(*booking, *conds))

    return {
        "today_check_ins": count(Reservation.start_at >= day_start, Reservation.start_at < day_end),
        "today_check_outs": count(Reservation.type == "STAY", Reservation.end_at >= day_start,
                                  Reservation.end_at < day_end),
        "week_reservations": count(Reservation.start_at >= week_start,
                                   Reservation.start_at < week_start + timedelta(days=7)),
        "month_revenue": db.scalar(select(func.coalesce(func.sum(Reservation.total_price), 0)).where(
            *booking, Reservation.start_at >= month_start, Reservation.start_at < next_month)),
        "today_timeline": list(db.scalars(select(Reservation).where(*occupying(day_start, day_end))
                                          .order_by(Reservation.start_at))),
        "upcoming": list(db.scalars(select(Reservation).where(*booking, Reservation.start_at > now)
                                    .order_by(Reservation.start_at, Reservation.id).limit(5))),
    }


def create_block(db: Session, start: datetime, end: datetime, reason: str) -> Reservation:
    """Blocks occupy exactly [start, end); the same exclusion constraint guards them against bookings."""
    lock_room(db)
    r = Reservation(room_id=ROOM_ID, type="BLOCK", status="CONFIRMED", start_at=start, end_at=end,
                    blocked_until=end, block_reason=reason, total_price=0)
    db.add(r)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if is_overlap_error(e):
            raise BlockOverlaps() from e
        raise
    return r


def upcoming_blocks(db: Session, now: datetime) -> list[Reservation]:
    return list(db.scalars(select(Reservation).where(
        Reservation.type == "BLOCK", Reservation.status == "CONFIRMED", Reservation.end_at > now)
        .order_by(Reservation.start_at)))


def delete_block(db: Session, r: Reservation, now: datetime) -> None:
    r.status, r.cancelled_at, r.cancelled_by = "CANCELLED", now, "ADMIN"
    db.commit()
