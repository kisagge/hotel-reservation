from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.domain.rules import RuleSettings

_D = RuleSettings()


class Base(DeclarativeBase):
    pass


def _ts(**kw) -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), **kw)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('USER','ADMIN')", name="users_role"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(30))
    phone: Mapped[str] = mapped_column(String(20))
    role: Mapped[str] = mapped_column(String(10), default="USER", server_default="USER")
    created_at: Mapped[datetime] = _ts(server_default=func.now())


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    capacity: Mapped[int] = mapped_column(Integer)
    bed: Mapped[str] = mapped_column(String(50))
    size_m2: Mapped[int] = mapped_column(Integer)
    amenities: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")

    photos: Mapped[list["RoomPhoto"]] = relationship(order_by="RoomPhoto.sort_order", cascade="all, delete-orphan")


class RoomPhoto(Base):
    __tablename__ = "room_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class RoomSettings(Base):
    __tablename__ = "room_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), unique=True)
    dayuse_weekday_price: Mapped[int] = mapped_column(default=_D.dayuse_weekday_price)
    dayuse_weekend_price: Mapped[int] = mapped_column(default=_D.dayuse_weekend_price)
    stay_weekday_price: Mapped[int] = mapped_column(default=_D.stay_weekday_price)
    stay_weekend_price: Mapped[int] = mapped_column(default=_D.stay_weekend_price)
    dayuse_first_start_hour: Mapped[int] = mapped_column(default=_D.dayuse_first_start_hour)
    dayuse_last_start_hour: Mapped[int] = mapped_column(default=_D.dayuse_last_start_hour)
    dayuse_hours: Mapped[int] = mapped_column(default=_D.dayuse_hours)
    stay_check_in_hour: Mapped[int] = mapped_column(default=_D.stay_check_in_hour)
    stay_check_out_hour: Mapped[int] = mapped_column(default=_D.stay_check_out_hour)
    stay_max_nights: Mapped[int] = mapped_column(default=_D.stay_max_nights)
    cleaning_buffer_minutes: Mapped[int] = mapped_column(default=_D.cleaning_buffer_minutes)
    guest_cancel_deadline_hours: Mapped[int] = mapped_column(default=_D.guest_cancel_deadline_hours)
    updated_at: Mapped[datetime] = _ts(server_default=func.now(), onupdate=func.now())

    RULE_FIELDS = tuple(RuleSettings.__dataclass_fields__)

    def to_rules(self) -> RuleSettings:
        return RuleSettings(**{f: getattr(self, f) for f in self.RULE_FIELDS})


class Reservation(Base):
    """A booking (DAYUSE/STAY) or an admin BLOCK. Overlaps are rejected by reservations_no_overlap."""

    __tablename__ = "reservations"
    __table_args__ = (
        CheckConstraint("type IN ('DAYUSE','STAY','BLOCK')", name="reservations_type"),
        CheckConstraint("status IN ('CONFIRMED','CANCELLED')", name="reservations_status"),
        CheckConstraint("cancelled_by IS NULL OR cancelled_by IN ('GUEST','ADMIN')", name="reservations_cancelled_by"),
        CheckConstraint("start_at < end_at AND end_at <= blocked_until", name="reservations_window"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str | None] = mapped_column(String(20), unique=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(10), default="CONFIRMED", server_default="CONFIRMED")
    start_at: Mapped[datetime] = _ts()
    end_at: Mapped[datetime] = _ts()
    blocked_until: Mapped[datetime] = _ts()
    nights: Mapped[int | None] = mapped_column(Integer)
    guest_name: Mapped[str] = mapped_column(String(30), default="", server_default="")
    guest_phone: Mapped[str | None] = mapped_column(String(20))
    block_reason: Mapped[str | None] = mapped_column(String(100))
    total_price: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = _ts(server_default=func.now())
    cancelled_at: Mapped[datetime | None] = _ts()
    cancelled_by: Mapped[str | None] = mapped_column(String(10))

    user: Mapped["User | None"] = relationship()
    payment: Mapped["Payment | None"] = relationship(back_populates="reservation", uselist=False)


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (CheckConstraint("status IN ('PAID','REFUNDED')", name="payments_status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    reservation_id: Mapped[int] = mapped_column(ForeignKey("reservations.id"), unique=True)
    provider: Mapped[str] = mapped_column(String(20))
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10), default="PAID", server_default="PAID")
    paid_at: Mapped[datetime] = _ts(server_default=func.now())
    refunded_at: Mapped[datetime | None] = _ts()

    reservation: Mapped[Reservation] = relationship(back_populates="payment")
