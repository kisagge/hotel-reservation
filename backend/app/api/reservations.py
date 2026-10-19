from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DB, CurrentUser, DbId
from app.core.clock import get_now
from app.domain.rules import RuleViolation
from app.models import Reservation
from app.schemas import ReservationIn, ReservationOut
from app.services import reservations as svc
from app.services.payments import PaymentProvider, get_payment_provider

router = APIRouter(prefix="/api/reservations", tags=["reservations"])
Now = Annotated[datetime, Depends(get_now)]
Payments = Annotated[PaymentProvider, Depends(get_payment_provider)]


def to_out(r: Reservation, now: datetime) -> ReservationOut:
    display = "COMPLETED" if r.status == "CONFIRMED" and r.end_at <= now else r.status
    return ReservationOut(id=r.id, code=r.code, type=r.type, status=r.status, display_status=display,
                          start_at=r.start_at, end_at=r.end_at, blocked_until=r.blocked_until, nights=r.nights,
                          guest_name=r.guest_name, guest_phone=r.guest_phone, total_price=r.total_price,
                          created_at=r.created_at, cancelled_at=r.cancelled_at,
                          cancel_deadline_at=r.cancel_deadline_at, can_cancel=svc.guest_can_cancel(r, now))


def cancel_or_409(db, r: Reservation, by, now: datetime, payments: PaymentProvider) -> None:
    try:
        svc.cancel_reservation(db, r, by, now, payments)
    except svc.AlreadyCancelled:
        raise HTTPException(status.HTTP_409_CONFLICT, "ALREADY_CANCELLED")
    except svc.CancelDeadlinePassed:
        raise HTTPException(status.HTTP_409_CONFLICT, "CANCEL_DEADLINE_PASSED")


@router.post("", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create(body: ReservationIn, user: CurrentUser, db: DB, now: Now, payments: Payments) -> ReservationOut:
    try:
        r = svc.create_reservation(db, user, body, body.guest_name, body.guest_phone, now, payments)
    except RuleViolation as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, e.code)
    except svc.SlotUnavailable as e:
        raise HTTPException(status.HTTP_409_CONFLICT, e.reason)
    return to_out(r, now)


@router.get("/me", response_model=list[ReservationOut])
def mine(user: CurrentUser, db: DB, now: Now) -> list[ReservationOut]:
    return [to_out(r, now) for r in svc.my_reservations(db, user)]


@router.post("/{reservation_id}/cancel", response_model=ReservationOut)
def cancel(reservation_id: DbId, user: CurrentUser, db: DB, now: Now, payments: Payments) -> ReservationOut:
    r = svc.get_for_update(db, reservation_id)
    if r is None or r.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NOT_FOUND")
    cancel_or_409(db, r, "GUEST", now, payments)
    return to_out(r, now)
