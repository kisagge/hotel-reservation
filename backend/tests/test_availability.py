from datetime import date, timedelta

from app.core.clock import kst
from app.domain.availability import dayuse_slots, stay_days
from app.domain.rules import RuleSettings

s = RuleSettings()
NOW = kst(date(2026, 10, 19), 9)
D23 = date(2026, 10, 23)


def avail(slots):
    return {sl.start_hour: sl.available for sl in slots}


def test_slots_blocked_by_morning_dayuse():
    busy = [(kst(D23, 10), kst(D23, 15))]
    slots = dayuse_slots(D23, busy, NOW, s)
    assert len(slots) == 11
    a = avail(slots)
    assert all(not a[h] for h in range(10, 15))
    assert all(a[h] for h in range(15, 21))
    assert slots[-1].end_hour == 24


def test_slot_after_stay_checkout():
    busy = [(kst(date(2026, 10, 22), 15), kst(D23, 12))]
    a = avail(dayuse_slots(D23, busy, NOW, s))
    assert a[10] is False and a[11] is False and a[12] is True


def test_dayuse_must_end_before_stay_checkin():
    busy = [(kst(D23, 15), kst(date(2026, 10, 24), 12))]
    a = avail(dayuse_slots(D23, busy, NOW, s))
    assert a[10] is True
    assert all(not a[h] for h in range(11, 21))


def test_past_slots_unavailable_kst_boundary():
    d19 = date(2026, 10, 19)
    just_after_midnight = kst(d19, 0, 30)
    assert all(avail(dayuse_slots(d19, [], just_after_midnight, s)).values())
    a = avail(dayuse_slots(d19, [], kst(d19, 12) + timedelta(minutes=1), s))
    assert not a[10] and not a[11] and not a[12] and a[13]


def test_stay_days_month():
    busy = [(kst(date(2026, 10, 27)), kst(date(2026, 10, 29)))]
    days = {d.date.day: d.available for d in stay_days(2026, 10, busy, NOW, s)}
    assert len(days) == 31
    assert days[26] is False and days[27] is False and days[28] is False
    assert days[29] is True
    assert days[19] is True
    assert not any(days[d] for d in range(1, 19))
