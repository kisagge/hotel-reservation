"""Pure booking rules: time windows and pricing. No database, no clock."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.core.clock import kst

WEEKDAY_KO = "월화수목금토일"
DAYUSE_WEEKEND = (5, 6)  # Sat, Sun
STAY_WEEKEND_NIGHTS = (4, 5)  # Fri, Sat nights


@dataclass(frozen=True)
class RuleSettings:
    dayuse_weekday_price: int = 35000
    dayuse_weekend_price: int = 45000
    stay_weekday_price: int = 79000
    stay_weekend_price: int = 89000
    dayuse_first_start_hour: int = 10
    dayuse_last_start_hour: int = 20
    dayuse_hours: int = 4
    stay_check_in_hour: int = 15
    stay_check_out_hour: int = 11
    stay_max_nights: int = 7
    cleaning_buffer_minutes: int = 60
    guest_cancel_deadline_hours: int = 24


@dataclass(frozen=True)
class Window:
    start_at: datetime
    end_at: datetime
    blocked_until: datetime


@dataclass(frozen=True)
class PriceLine:
    label: str
    amount: int


@dataclass(frozen=True)
class Quote:
    window: Window
    nights: int | None
    lines: list[PriceLine]
    total: int


class RuleViolation(ValueError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _window(start: datetime, end: datetime, s: RuleSettings) -> Window:
    return Window(start, end, end + timedelta(minutes=s.cleaning_buffer_minutes))


def dayuse_window(d: date, start_hour: int, s: RuleSettings) -> Window:
    if not s.dayuse_first_start_hour <= start_hour <= s.dayuse_last_start_hour:
        raise RuleViolation("START_HOUR_OUT_OF_RANGE")
    start = kst(d, start_hour)
    return _window(start, start + timedelta(hours=s.dayuse_hours), s)


def stay_window(check_in: date, nights: int, s: RuleSettings) -> Window:
    if not 1 <= nights <= s.stay_max_nights:
        raise RuleViolation("NIGHTS_OUT_OF_RANGE")
    start = kst(check_in, s.stay_check_in_hour)
    end = kst(check_in + timedelta(days=nights), s.stay_check_out_hour)
    return _window(start, end, s)


def quote_dayuse(d: date, start_hour: int, s: RuleSettings) -> Quote:
    window = dayuse_window(d, start_hour, s)
    weekend = d.weekday() in DAYUSE_WEEKEND
    amount = s.dayuse_weekend_price if weekend else s.dayuse_weekday_price
    label = f"대실 · {'주말' if weekend else '평일'} {s.dayuse_hours}시간"
    return Quote(window, None, [PriceLine(label, amount)], amount)


def quote_stay(check_in: date, nights: int, s: RuleSettings) -> Quote:
    window = stay_window(check_in, nights, s)
    lines = []
    for i in range(nights):
        night = check_in + timedelta(days=i)
        weekend = night.weekday() in STAY_WEEKEND_NIGHTS
        amount = s.stay_weekend_price if weekend else s.stay_weekday_price
        label = f"{night.month}/{night.day} ({WEEKDAY_KO[night.weekday()]}) · {'주말' if weekend else '평일'} 요금"
        lines.append(PriceLine(label, amount))
    return Quote(window, nights, lines, sum(l.amount for l in lines))
