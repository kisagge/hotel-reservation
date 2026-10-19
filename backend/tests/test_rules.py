from datetime import date

import pytest

from app.core.clock import kst
from app.domain.rules import (
    RuleSettings,
    RuleViolation,
    dayuse_window,
    quote_dayuse,
    quote_stay,
    stay_window,
)

s = RuleSettings()


def test_dayuse_window_friday_15():
    w = dayuse_window(date(2026, 10, 23), 15, s)
    assert w.start_at == kst(date(2026, 10, 23), 15)
    assert w.end_at == kst(date(2026, 10, 23), 19)
    assert w.blocked_until == kst(date(2026, 10, 23), 20)


def test_dayuse_last_start_crosses_midnight():
    w = dayuse_window(date(2026, 10, 23), 20, s)
    assert w.end_at == kst(date(2026, 10, 24), 0)


@pytest.mark.parametrize("hour", [9, 21])
def test_dayuse_hour_out_of_range(hour):
    with pytest.raises(RuleViolation) as e:
        dayuse_window(date(2026, 10, 23), hour, s)
    assert e.value.code == "START_HOUR_OUT_OF_RANGE"


def test_stay_window_two_nights():
    w = stay_window(date(2026, 10, 23), 2, s)
    assert w.start_at == kst(date(2026, 10, 23), 15)
    assert w.end_at == kst(date(2026, 10, 25), 11)
    assert w.blocked_until == kst(date(2026, 10, 25), 12)


@pytest.mark.parametrize("nights", [0, 8])
def test_stay_nights_out_of_range(nights):
    with pytest.raises(RuleViolation) as e:
        stay_window(date(2026, 10, 23), nights, s)
    assert e.value.code == "NIGHTS_OUT_OF_RANGE"


def test_quote_dayuse_weekday_vs_weekend():
    assert quote_dayuse(date(2026, 10, 23), 15, s).total == 35000
    assert quote_dayuse(date(2026, 10, 24), 15, s).total == 45000
    assert quote_dayuse(date(2026, 10, 25), 15, s).total == 45000
    assert quote_dayuse(date(2026, 10, 23), 15, s).lines[0].label == "대실 · 평일 4시간"
    assert quote_dayuse(date(2026, 10, 24), 15, s).lines[0].label == "대실 · 주말 4시간"


def test_quote_stay_mixed_nights():
    q = quote_stay(date(2026, 10, 22), 3, s)
    assert [l.amount for l in q.lines] == [79000, 89000, 89000]
    assert q.total == 257000
    assert q.nights == 3


def test_quote_stay_fri_sat():
    q = quote_stay(date(2026, 10, 23), 2, s)
    assert q.total == 178000
    assert q.lines[0].label == "10/23 (금) · 주말 요금"
