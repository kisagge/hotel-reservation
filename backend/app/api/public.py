import calendar
from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import DB
from app.core.clock import get_now, kst
from app.domain import availability
from app.domain.rules import RuleViolation
from app.models import Room
from app.schemas import (
    DayUseAvailabilityOut,
    PriceLineOut,
    PublicRules,
    QuoteIn,
    QuoteOut,
    RoomOut,
    StayAvailabilityOut,
)
from app.services import reservations as svc

router = APIRouter(prefix="/api", tags=["public"])
Now = Annotated[datetime, Depends(get_now)]


def rule_error(e: RuleViolation) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, e.code)


@router.get("/room", response_model=RoomOut)
def get_room(db: DB) -> RoomOut:
    room = db.get(Room, svc.ROOM_ID)
    rules = PublicRules.model_validate(svc.load_settings(db))
    return RoomOut.model_validate({**{c: getattr(room, c) for c in RoomOut.model_fields if c != "rules"},
                                   "rules": rules})


@router.get("/availability/dayuse", response_model=DayUseAvailabilityOut)
def dayuse_availability(date: date, db: DB, now: Now) -> DayUseAvailabilityOut:
    busy = svc.busy_between(db, kst(date), kst(date + timedelta(days=2)))
    slots = availability.dayuse_slots(date, busy, now, svc.load_rules(db))
    return DayUseAvailabilityOut(date=date, slots=[s.__dict__ for s in slots])


@router.get("/availability/stay", response_model=StayAvailabilityOut)
def stay_availability(db: DB, now: Now,
                      month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")) -> StayAvailabilityOut:
    year, mon = map(int, month.split("-"))
    _, last = calendar.monthrange(year, mon)
    rules = svc.load_rules(db)
    busy = svc.busy_between(db, kst(date(year, mon, 1)),
                            kst(date(year, mon, last) + timedelta(days=2 + rules.stay_max_nights)))
    days = availability.stay_days(year, mon, busy, now, rules)
    return StayAvailabilityOut(month=month, days=[d.__dict__ for d in days])


@router.post("/quotes", response_model=QuoteOut)
def create_quote(body: QuoteIn, db: DB, now: Now) -> QuoteOut:
    try:
        quote, reason = svc.evaluate_quote(db, body, now)
    except RuleViolation as e:
        raise rule_error(e)
    return QuoteOut(type=body.type, start_at=quote.window.start_at, end_at=quote.window.end_at, nights=quote.nights,
                    lines=[PriceLineOut(label=l.label, amount=l.amount) for l in quote.lines], total=quote.total,
                    available=reason is None, reason=reason)
