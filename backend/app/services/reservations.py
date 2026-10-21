"""Reservation persistence and queries. Business rules live in app.domain."""

import random
import time
from collections.abc import Callable
from datetime import date, datetime, timedelta
from typing import Literal

from sqlalchemy import Select, func, literal, or_, select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.core.clock import KST, kst, today_kst
from app.core.config import get_settings
from app.domain.availability import Busy, overlaps
from app.domain.rules import Quote, RuleSettings, RuleViolation, quote_dayuse, quote_stay
from app.models import Payment, Reservation, RoomSettings, User
from app.schemas import QuoteIn
from app.services.payments import PaymentProvider

ROOM_ID = 1
BOOKING_TYPES = ("DAYUSE", "STAY")
OVERLAP_SQLSTATE = "23P01"
LOCK_TIMEOUT_SQLSTATE = "55P03"


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


class ReservationStarted(Exception):
    pass


class ServiceBusy(Exception):
    """The room's write lock stayed busy past booking_lock_timeout_ms; safe to retry."""


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


def busy_query(start: datetime, end: datetime, exclude_id: int | None = None) -> Select:
    stmt = select(Reservation.start_at, Reservation.blocked_until).where(*occupying(start, end))
    # only a booking can be "moved"; a block id never hides the block
    return stmt if exclude_id is None else stmt.where(or_(Reservation.id != exclude_id, Reservation.type == "BLOCK"))


def busy_between(db: Session, start: datetime, end: datetime, exclude_id: int | None = None) -> list[Busy]:
    """`exclude_id`: a booking being moved does not collide with its own current window."""
    return [(r.start_at, r.blocked_until) for r in db.execute(busy_query(start, end, exclude_id))]


def build_quote(q: QuoteIn, rules: RuleSettings) -> Quote:
    """Raises RuleViolation for inputs outside the configured rules."""
    if q.type == "DAYUSE":
        return quote_dayuse(q.date, q.start_hour, rules)
    return quote_stay(q.check_in, q.nights, rules)


def booking_horizon(now: datetime) -> datetime:
    """Bookings must start before this instant: midnight KST after the last bookable day."""
    return kst(today_kst(now) + timedelta(days=get_settings().booking_horizon_days + 1))


def evaluate_quote(db: Session, q: QuoteIn, now: datetime, rules: RuleSettings | None = None,
                   exclude_id: int | None = None) -> tuple[Quote, str | None]:
    """Quote plus the reason it cannot be booked right now (None if bookable). Beyond the horizon → RuleViolation."""
    quote = build_quote(q, rules or load_rules(db))
    w = quote.window
    if w.start_at >= booking_horizon(now):
        raise RuleViolation("DATE_OUT_OF_RANGE")
    if w.start_at <= now:
        return quote, "IN_THE_PAST"
    if overlaps(w, busy_between(db, w.start_at, w.blocked_until, exclude_id)):
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


EPOCH = date(2000, 1, 1)


def day_lock_keys(start: datetime, end: datetime) -> list[tuple[int, int]]:
    """(room, KST-day ordinal) advisory-lock keys for every calendar day [start, end] touches, ascending.
    Two windows that overlap always share at least one day, so they serialize on that key; windows on
    different days never wait on each other. Fixed ascending order means two multi-day writers cannot deadlock."""
    first, last = start.astimezone(KST).date(), end.astimezone(KST).date()
    return [(ROOM_ID, (first - EPOCH).days + i) for i in range((last - first).days + 1)]


def _try_lock_days(db: Session, start: datetime, end: datetime) -> bool:
    """Take every day lock without waiting (ascending order); False means another writer holds one."""
    for room, ordinal in day_lock_keys(start, end):
        if not db.scalar(select(func.pg_try_advisory_xact_lock(room, ordinal))):
            return False
    return True


def lock_days(db: Session, start: datetime, end: datetime, still_possible: Callable[[], None] | None = None) -> None:
    """Serialize occupancy writes for the days a window touches, until commit.

    Concurrent inserts racing inside the exclusion check would deadlock each other (40P01); taking these locks
    first means the check never sees two inserters, and the quote re-evaluated after it already sees the winner.
    Waiting never pins a pooled connection: when a lock is busy we roll back (returning the connection), back off
    with jitter, and re-run `still_possible` (a lock-free check that raises once the slot is gone, so losers
    leave with 409 as soon as the winner commits). Past booking_lock_timeout_ms → ServiceBusy (HTTP 503)."""
    deadline = time.monotonic() + get_settings().booking_lock_timeout_ms / 1000
    delay = 0.01
    while True:
        if _try_lock_days(db, start, end):
            return
        db.rollback()
        if time.monotonic() >= deadline:
            raise ServiceBusy()
        time.sleep(min(delay, max(0.0, deadline - time.monotonic())) * random.uniform(0.5, 1.5))
        delay = min(delay * 2, 0.2)
        if still_possible:
            still_possible()


def create_reservation(db: Session, user: User | None, q: QuoteIn, guest_name: str, guest_phone: str, now: datetime,
                       payments: PaymentProvider) -> Reservation:
    rules = load_rules(db)  # one settings snapshot for price, buffer and cancel deadline

    def still_possible() -> None:
        """Lock-free check: in a burst most requests target a slot that is already gone."""
        _, why = evaluate_quote(db, q, now, rules)
        if why:
            db.rollback()
            raise SlotUnavailable(why)

    still_possible()
    quote = build_quote(q, rules)
    lock_days(db, quote.window.start_at, quote.window.blocked_until, still_possible)
    quote, reason = evaluate_quote(db, q, now, rules)  # authoritative re-check under the lock
    if reason:
        db.rollback()  # release the day locks now, not when the response has been sent
        raise SlotUnavailable(reason)
    w = quote.window
    r = Reservation(room_id=ROOM_ID, user_id=user.id if user else None, type=q.type, status="CONFIRMED", start_at=w.start_at,
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


def _check_reschedulable(r: Reservation | None, now: datetime) -> Reservation:
    if r is None or r.type not in BOOKING_TYPES:
        raise LookupError()
    if r.status == "CANCELLED":
        raise AlreadyCancelled()
    if r.start_at <= now:
        raise ReservationStarted()
    return r


def reschedule_reservation(db: Session, reservation_id: int, q: QuoteIn, now: datetime,
                           payments: PaymentProvider) -> Reservation:
    """Move a not-yet-started booking to a new window (type may change), repriced with the current settings.

    Same path as create_reservation: lock-free checks, day locks for the new window, authoritative re-check.
    The row lock is taken only after the day locks, because lock_days rolls back while it waits (which would
    drop a row lock held earlier); cancels take only the row lock, so the two cannot deadlock."""
    rules = load_rules(db)
    _check_reschedulable(db.get(Reservation, reservation_id), now)

    def still_possible() -> None:
        _, why = evaluate_quote(db, q, now, rules, exclude_id=reservation_id)
        if why:
            db.rollback()
            raise SlotUnavailable(why)

    still_possible()
    w = build_quote(q, rules).window
    lock_days(db, w.start_at, w.blocked_until, still_possible)
    try:
        # The row may be held by a cancel or another reschedule. Wait at most booking_lock_timeout_ms (then 503),
        # never indefinitely while holding this day's locks and a pooled connection.
        db.execute(text(f"SET LOCAL lock_timeout = '{max(1, get_settings().booking_lock_timeout_ms)}ms'"))
        r = _check_reschedulable(get_for_update(db, reservation_id), now)
        quote, reason = evaluate_quote(db, q, now, rules, exclude_id=reservation_id)
        if reason:
            raise SlotUnavailable(reason)
        w = quote.window
        payment = r.payment  # loaded before the window changes (a lazy load would autoflush the new window)
        r.type, r.start_at, r.end_at, r.blocked_until = q.type, w.start_at, w.end_at, w.blocked_until
        r.nights, r.total_price = quote.nights, quote.total
        r.cancel_deadline_at = w.start_at - timedelta(hours=rules.guest_cancel_deadline_hours)
        db.flush()  # the exclusion constraint stays the backstop; money moves only after it passes
        if payment and payment.status == "PAID" and payment.amount != quote.total:
            payments.adjust(payment, quote.total)
            payment.amount = quote.total
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if is_overlap_error(e):
            raise SlotUnavailable() from e
        raise
    except OperationalError as e:
        db.rollback()
        if getattr(e.orig, "sqlstate", None) == LOCK_TIMEOUT_SQLSTATE:
            raise ServiceBusy() from e
        raise
    except Exception:
        db.rollback()  # release the day and row locks now, not after the response is sent
        raise
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


OCCUPANCY_MAX_DAYS = 62  # a month view plus the spill-over weeks around it


def occupancy(db: Session, date_from: date, date_to: date) -> list[Reservation]:
    """CONFIRMED bookings and blocks occupying any KST day in [date_from, date_to] (admin calendar)."""
    stmt = select(Reservation).where(*occupying(kst(date_from), kst(date_to + timedelta(days=1))))
    return list(db.scalars(stmt.order_by(Reservation.start_at, Reservation.id)))


def create_block(db: Session, start: datetime, end: datetime, reason: str) -> Reservation:
    """Blocks occupy exactly [start, end); the same exclusion constraint guards them against bookings."""
    lock_days(db, start, end)
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
