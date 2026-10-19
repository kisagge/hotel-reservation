from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import DB, require_admin
from app.api.reservations import Now, Payments, cancel_or_409, to_out
from app.models import Reservation
from app.schemas import AdminReservationOut, DashboardOut, PaymentOut, ReservationPage, TimelineItem
from app.services import reservations as svc

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def get_booking(db, reservation_id: int) -> Reservation:
    r = db.get(Reservation, reservation_id)
    if r is None or r.type == "BLOCK":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NOT_FOUND")
    return r


def to_admin_out(r: Reservation, now: datetime, db) -> AdminReservationOut:
    base = to_out(r, now, svc.load_rules(db))
    return AdminReservationOut(**base.model_dump(), user_email=r.user.email if r.user else None,
                               cancelled_by=r.cancelled_by,
                               payment=PaymentOut.model_validate(r.payment) if r.payment else None)


@router.get("/reservations", response_model=ReservationPage)
def list_reservations(
    db: DB, now: Now,
    date_from: date | None = None, date_to: date | None = None,
    type: Literal["DAYUSE", "STAY"] | None = None, status: Literal["CONFIRMED", "CANCELLED"] | None = None,
    q: Annotated[str | None, Query(max_length=50)] = None,
    page: Annotated[int, Query(ge=1)] = 1, size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ReservationPage:
    items, total = svc.admin_list(db, date_from=date_from, date_to=date_to, type=type, status=status, q=q,
                                  page=page, size=size)
    rules = svc.load_rules(db)
    return ReservationPage(items=[to_out(r, now, rules) for r in items], total=total, page=page, size=size)


@router.get("/reservations/{reservation_id}", response_model=AdminReservationOut)
def reservation_detail(reservation_id: int, db: DB, now: Now) -> AdminReservationOut:
    return to_admin_out(get_booking(db, reservation_id), now, db)


@router.post("/reservations/{reservation_id}/cancel", response_model=AdminReservationOut)
def admin_cancel(reservation_id: int, db: DB, now: Now, payments: Payments) -> AdminReservationOut:
    r = get_booking(db, reservation_id)
    cancel_or_409(db, r, "ADMIN", now, payments)
    return to_admin_out(r, now, db)


@router.get("/dashboard", response_model=DashboardOut)
def get_dashboard(db: DB, now: Now) -> DashboardOut:
    d = svc.dashboard(db, now)
    rules = svc.load_rules(db)
    return DashboardOut(**{k: d[k] for k in ("today_check_ins", "today_check_outs", "week_reservations",
                                             "month_revenue")},
                        today_timeline=[TimelineItem.model_validate(r) for r in d["today_timeline"]],
                        upcoming=[to_out(r, now, rules) for r in d["upcoming"]])
