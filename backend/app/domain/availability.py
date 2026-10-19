"""Pure availability checks over half-open [start_at, blocked_until) intervals."""

import calendar
from dataclasses import dataclass
from datetime import date, datetime

from app.domain.rules import RuleSettings, Window, dayuse_window, stay_window

Busy = tuple[datetime, datetime]  # (start_at, blocked_until) of CONFIRMED rows, blocks included


@dataclass(frozen=True)
class Slot:
    start_hour: int
    end_hour: int
    available: bool


@dataclass(frozen=True)
class DayAvailability:
    date: date
    available: bool


def overlaps(w: Window, busy: list[Busy]) -> bool:
    return any(w.start_at < b_end and b_start < w.blocked_until for b_start, b_end in busy)


def is_bookable(w: Window, busy: list[Busy], now: datetime) -> bool:
    return w.start_at > now and not overlaps(w, busy)


def dayuse_slots(d: date, busy: list[Busy], now: datetime, s: RuleSettings) -> list[Slot]:
    slots = []
    for hour in range(s.dayuse_first_start_hour, s.dayuse_last_start_hour + 1):
        w = dayuse_window(d, hour, s)
        slots.append(Slot(hour, hour + s.dayuse_hours, is_bookable(w, busy, now)))
    return slots


def stay_days(year: int, month: int, busy: list[Busy], now: datetime, s: RuleSettings) -> list[DayAvailability]:
    """Whether a one-night stay can check in on each day. Multi-night ranges are judged by quote/create."""
    _, last = calendar.monthrange(year, month)
    result = []
    for day in range(1, last + 1):
        d = date(year, month, day)
        result.append(DayAvailability(d, is_bookable(stay_window(d, 1, s), busy, now)))
    return result
