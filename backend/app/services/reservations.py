"""Reservation persistence and queries. Business rules live in app.domain."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.availability import Busy, overlaps
from app.domain.rules import Quote, RuleSettings, quote_dayuse, quote_stay
from app.models import Reservation, RoomSettings
from app.schemas import QuoteIn

ROOM_ID = 1


def load_settings(db: Session) -> RoomSettings:
    return db.scalars(select(RoomSettings).where(RoomSettings.room_id == ROOM_ID)).one()


def load_rules(db: Session) -> RuleSettings:
    return load_settings(db).to_rules()


def busy_between(db: Session, start: datetime, end: datetime) -> list[Busy]:
    rows = db.execute(
        select(Reservation.start_at, Reservation.blocked_until).where(
            Reservation.room_id == ROOM_ID,
            Reservation.status == "CONFIRMED",
            Reservation.start_at < end,
            Reservation.blocked_until > start,
        )
    )
    return [(r.start_at, r.blocked_until) for r in rows]


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


# ---- commands ----------------------------------------------------------------
from datetime import timedelta
from typing import Literal

from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.clock import KST
from app.models import Payment, User
from app.services.payments import PaymentProvider

OVERLAP_SQLSTATE = "23P01"
DEADLOCK_SQLSTATE = "40P01"  # two concurrent conflicting inserts wait on each other's exclusion check


class SlotUnavailable(Exception):
    def __init__(self, reason: str = "SLOT_UNAVAILABLE"):
        super().__init__(reason)
        self.reason = reason


class CancelDeadlinePassed(Exception):
    pass


class AlreadyCancelled(Exception):
    pass


def is_overlap_error(e: IntegrityError) -> bool:
    return getattr(e.orig, "sqlstate", None) == OVERLAP_SQLSTATE


def is_deadlock(e: OperationalError) -> bool:
    return getattr(e.orig, "sqlstate", None) == DEADLOCK_SQLSTATE


def create_reservation(db: Session, user: User, q: QuoteIn, guest_name: str, guest_phone: str, now: datetime,
                       payments: PaymentProvider) -> Reservation:
    """Insert a CONFIRMED reservation; a deadlock with a concurrent insert is retried once, after which the
    re-evaluated quote sees the winner and raises SlotUnavailable."""
    try:
        return _insert_reservation(db, user, q, guest_name, guest_phone, now, payments)
    except OperationalError as e:
        db.rollback()
        if not is_deadlock(e):
            raise
    return _insert_reservation(db, user, q, guest_name, guest_phone, now, payments)


def _insert_reservation(db: Session, user: User, q: QuoteIn, guest_name: str, guest_phone: str, now: datetime,
                        payments: PaymentProvider) -> Reservation:
    quote, reason = evaluate_quote(db, q, now)
    if reason:
        raise SlotUnavailable(reason)
    w = quote.window
    r = Reservation(room_id=ROOM_ID, user_id=user.id, type=q.type, status="CONFIRMED", start_at=w.start_at,
                    end_at=w.end_at, blocked_until=w.blocked_until, nights=quote.nights, guest_name=guest_name,
                    guest_phone=guest_phone, total_price=quote.total)
    db.add(r)
    try:
        db.flush()  # the exclusion constraint decides races here
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


def guest_can_cancel(r: Reservation, now: datetime, rules: RuleSettings) -> bool:
    return r.status == "CONFIRMED" and now <= r.start_at - timedelta(hours=rules.guest_cancel_deadline_hours)


def cancel_reservation(db: Session, r: Reservation, by: Literal["GUEST", "ADMIN"], now: datetime,
                       rules: RuleSettings, payments: PaymentProvider) -> Reservation:
    if r.status == "CANCELLED":
        raise AlreadyCancelled()
    allowed = guest_can_cancel(r, now, rules) if by == "GUEST" else now < r.start_at
    if not allowed:
        raise CancelDeadlinePassed()
    r.status, r.cancelled_at, r.cancelled_by = "CANCELLED", now, by
    if r.payment and r.payment.status == "PAID":
        payments.refund(r.payment)
        r.payment.status, r.payment.refunded_at = "REFUNDED", now
    db.commit()
    return r


def my_reservations(db: Session, user: User) -> list[Reservation]:
    return list(db.scalars(select(Reservation).where(Reservation.user_id == user.id)
                           .order_by(Reservation.start_at)))
