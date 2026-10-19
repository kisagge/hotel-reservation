from datetime import date, datetime, time
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")


def get_now() -> datetime:
    """Current time; the only sanctioned clock. Overridden in tests."""
    return datetime.now(KST)


def kst(d: date, hour: int = 0, minute: int = 0) -> datetime:
    """Wall-clock time on a KST calendar date."""
    return datetime.combine(d, time(hour, minute), tzinfo=KST)


def today_kst(now: datetime) -> date:
    return now.astimezone(KST).date()
