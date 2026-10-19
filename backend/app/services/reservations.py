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
