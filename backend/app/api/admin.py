import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status

from app.api.deps import DB, require_admin
from app.api.reservations import Now, Payments, cancel_or_409, to_out
from app.core.config import get_settings
from app.models import Reservation, Room, RoomPhoto
from app.schemas import (
    AdminReservationOut,
    BlockIn,
    BlockOut,
    DashboardOut,
    PaymentOut,
    PhotoOut,
    ReservationPage,
    RoomIn,
    SettingsIn,
    TimelineItem,
)
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


# ---- settings ----
@router.get("/settings", response_model=SettingsIn)
def get_room_settings(db: DB) -> SettingsIn:
    return SettingsIn.model_validate(svc.load_settings(db))


@router.put("/settings", response_model=SettingsIn)
def update_room_settings(body: SettingsIn, db: DB) -> SettingsIn:
    """Applies to new reservations only; stored blocked_until values are never recomputed."""
    settings = svc.load_settings(db)
    for field, value in body.model_dump().items():
        setattr(settings, field, value)
    db.commit()
    return SettingsIn.model_validate(settings)


# ---- blocks ----
def to_block_out(r: Reservation) -> BlockOut:
    return BlockOut(id=r.id, start_at=r.start_at, end_at=r.end_at, reason=r.block_reason or "")


@router.get("/blocks", response_model=list[BlockOut])
def list_blocks(db: DB, now: Now) -> list[BlockOut]:
    return [to_block_out(r) for r in svc.upcoming_blocks(db, now)]


@router.post("/blocks", response_model=BlockOut, status_code=status.HTTP_201_CREATED)
def create_block(body: BlockIn, db: DB) -> BlockOut:
    try:
        return to_block_out(svc.create_block(db, body.start_at, body.end_at, body.reason))
    except svc.BlockOverlaps:
        raise HTTPException(status.HTTP_409_CONFLICT, "BLOCK_OVERLAPS_RESERVATION")


@router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block(block_id: int, db: DB, now: Now) -> None:
    r = db.get(Reservation, block_id)
    if r is None or r.type != "BLOCK" or r.status != "CONFIRMED":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NOT_FOUND")
    svc.delete_block(db, r, now)


# ---- room ----
MAX_PHOTO_BYTES = 5 * 1024 * 1024
PHOTO_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


@router.put("/room")
def update_room(body: RoomIn, db: DB) -> dict[str, str]:
    room = db.get(Room, svc.ROOM_ID)
    for field, value in body.model_dump().items():
        setattr(room, field, value)
    db.commit()
    return {"status": "ok"}


@router.post("/room/photos", response_model=PhotoOut, status_code=status.HTTP_201_CREATED)
def upload_photo(file: UploadFile, db: DB) -> RoomPhoto:
    ext = PHOTO_EXT.get(file.content_type or "")
    if ext is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "UNSUPPORTED_IMAGE_TYPE")
    data = file.file.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "IMAGE_TOO_LARGE")
    upload_dir = Path(get_settings().upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    (upload_dir / name).write_bytes(data)
    room = db.get(Room, svc.ROOM_ID)
    photo = RoomPhoto(room_id=room.id, url=f"/uploads/{name}", sort_order=len(room.photos))
    db.add(photo)
    db.commit()
    return photo


@router.delete("/room/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(photo_id: int, db: DB) -> None:
    photo = db.get(RoomPhoto, photo_id)
    if photo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NOT_FOUND")
    (Path(get_settings().upload_dir) / Path(photo.url).name).unlink(missing_ok=True)
    db.delete(photo)
    db.commit()
