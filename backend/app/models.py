from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, func, text
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
    __table_args__ = (
        CheckConstraint("role IN ('USER','ADMIN')", name="users_role"),
        CheckConstraint("email = lower(email)", name="users_email_lower"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(30))
    phone: Mapped[str] = mapped_column(String(20))
    role: Mapped[str] = mapped_column(String(10), default="USER", server_default="USER")
    created_at: Mapped[datetime] = _ts(server_default=func.now())


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (CheckConstraint("capacity >= 1 AND size_m2 >= 1", name="rooms_sizes"),)

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
    __table_args__ = (Index("ix_room_photos_room_sort", "room_id", "sort_order"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class RoomSettings(Base):
    __tablename__ = "room_settings"
    __table_args__ = tuple(CheckConstraint(expr, name=name) for name, expr in {
        "room_settings_prices": "dayuse_weekday_price > 0 AND dayuse_weekend_price > 0 AND stay_weekday_price > 0 AND stay_weekend_price > 0",
        "room_settings_dayuse": "dayuse_first_start_hour BETWEEN 0 AND 23 AND dayuse_last_start_hour BETWEEN dayuse_first_start_hour AND 23"
                                " AND dayuse_hours BETWEEN 1 AND 12",
        "room_settings_stay": "stay_check_out_hour BETWEEN 0 AND 23 AND stay_check_in_hour BETWEEN 0 AND 23 AND stay_max_nights BETWEEN 1 AND 30",
        "room_settings_policy": "cleaning_buffer_minutes BETWEEN 0 AND 240 AND guest_cancel_deadline_hours BETWEEN 0 AND 168",
        # A guest checking out at 11:00 plus cleaning must be done before the next 15:00 check-in.
        "room_settings_turnover": "stay_check_out_hour * 60 + cleaning_buffer_minutes <= stay_check_in_hour * 60",
    }.items())

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
        # Every row is exactly one valid kind: a BLOCK (no guest, no price, no buffer) or a booking with its policy snapshot.
        CheckConstraint(
            "(type = 'BLOCK' AND user_id IS NULL AND total_price = 0 AND nights IS NULL AND block_reason IS NOT NULL"
            " AND cancel_deadline_at IS NULL AND end_at = blocked_until)"
            " OR (type = 'DAYUSE' AND nights IS NULL AND block_reason IS NULL AND cancel_deadline_at IS NOT NULL AND guest_name <> '')"
            " OR (type = 'STAY' AND nights IS NOT NULL AND nights >= 1 AND block_reason IS NULL AND cancel_deadline_at IS NOT NULL AND guest_name <> '')",
            name="reservations_kind_shape",
        ),
        CheckConstraint("(status = 'CANCELLED') = (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)", name="reservations_cancel_state"),
        CheckConstraint("total_price >= 0", name="reservations_price_nonneg"),
        Index("ix_reservations_user_start", "user_id", "start_at"),
        Index("ix_reservations_start_at", "start_at"),
        Index("ix_reservations_blocks_upcoming", "start_at", postgresql_where=text("type = 'BLOCK' AND status = 'CONFIRMED'")),
        *(Index(f"ix_reservations_{c}_trgm", c, postgresql_using="gin", postgresql_ops={c: "gin_trgm_ops"})
          for c in ("code", "guest_name", "guest_phone")),
        # reservations_no_overlap (EXCLUDE USING gist) lives in migration 0001; Alembic cannot reflect exclusion constraints.
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
    cancel_deadline_at: Mapped[datetime | None] = _ts()  # guest policy snapshot taken at booking time
    cancelled_at: Mapped[datetime | None] = _ts()
    cancelled_by: Mapped[str | None] = mapped_column(String(10))

    user: Mapped["User | None"] = relationship()
    payment: Mapped["Payment | None"] = relationship(back_populates="reservation", uselist=False)


class RateLimitHit(Base):
    """Fixed-window counters for auth rate limits, shared by every API process and server."""

    __tablename__ = "rate_limit_hits"

    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    window_start: Mapped[datetime] = _ts(primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("status IN ('PAID','REFUNDED')", name="payments_status"),
        CheckConstraint("amount >= 0", name="payments_amount_nonneg"),
        CheckConstraint("(status = 'REFUNDED') = (refunded_at IS NOT NULL)", name="payments_refund_state"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reservation_id: Mapped[int] = mapped_column(ForeignKey("reservations.id"), unique=True)
    provider: Mapped[str] = mapped_column(String(20))
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10), default="PAID", server_default="PAID")
    paid_at: Mapped[datetime] = _ts(server_default=func.now())
    refunded_at: Mapped[datetime | None] = _ts()

    reservation: Mapped[Reservation] = relationship(back_populates="payment")
