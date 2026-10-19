from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, model_validator


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- auth ----
class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=30)
    phone: str = Field(min_length=9, max_length=20)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: int
    email: str
    name: str
    phone: str
    role: str


# ---- shared ----
from datetime import date as Date, datetime
from typing import Annotated, Literal

from pydantic import PlainSerializer

from app.core.clock import KST

KSTDatetime = Annotated[datetime, PlainSerializer(lambda d: d.astimezone(KST).isoformat(), return_type=str)]


# ---- room ----
class PhotoOut(ORM):
    id: int
    url: str


class PublicRules(ORM):
    dayuse_weekday_price: int
    dayuse_weekend_price: int
    stay_weekday_price: int
    stay_weekend_price: int
    dayuse_first_start_hour: int
    dayuse_last_start_hour: int
    dayuse_hours: int
    stay_check_in_hour: int
    stay_check_out_hour: int
    stay_max_nights: int
    cleaning_buffer_minutes: int
    guest_cancel_deadline_hours: int


class RoomOut(ORM):
    id: int
    name: str
    description: str
    capacity: int
    bed: str
    size_m2: int
    amenities: list[str]
    photos: list[PhotoOut]
    rules: PublicRules


# ---- availability ----
class SlotOut(BaseModel):
    start_hour: int
    end_hour: int
    available: bool


class DayUseAvailabilityOut(BaseModel):
    date: Date
    slots: list[SlotOut]


class DayOut(BaseModel):
    date: Date
    available: bool


class StayAvailabilityOut(BaseModel):
    month: str
    days: list[DayOut]


# ---- quotes ----
class DayUseQuoteIn(BaseModel):
    type: Literal["DAYUSE"]
    date: Date
    start_hour: int


class StayQuoteIn(BaseModel):
    type: Literal["STAY"]
    check_in: Date
    nights: int


QuoteIn = Annotated[DayUseQuoteIn | StayQuoteIn, Field(discriminator="type")]


class PriceLineOut(BaseModel):
    label: str
    amount: int


class QuoteOut(BaseModel):
    type: Literal["DAYUSE", "STAY"]
    start_at: KSTDatetime
    end_at: KSTDatetime
    nights: int | None
    lines: list[PriceLineOut]
    total: int
    available: bool
    reason: Literal["SLOT_UNAVAILABLE", "IN_THE_PAST"] | None


# ---- reservations ----
class GuestInfo(BaseModel):
    guest_name: str = Field(min_length=1, max_length=30)
    guest_phone: str = Field(min_length=9, max_length=20)


class DayUseReservationIn(DayUseQuoteIn, GuestInfo):
    pass


class StayReservationIn(StayQuoteIn, GuestInfo):
    pass


ReservationIn = Annotated[DayUseReservationIn | StayReservationIn, Field(discriminator="type")]


class ReservationOut(BaseModel):
    id: int
    code: str | None
    type: Literal["DAYUSE", "STAY", "BLOCK"]
    status: Literal["CONFIRMED", "CANCELLED"]
    display_status: Literal["CONFIRMED", "CANCELLED", "COMPLETED"]
    start_at: KSTDatetime
    end_at: KSTDatetime
    blocked_until: KSTDatetime
    nights: int | None
    guest_name: str
    guest_phone: str | None
    total_price: int
    created_at: KSTDatetime
    cancelled_at: KSTDatetime | None
    can_cancel: bool


# ---- admin ----
class PaymentOut(ORM):
    provider: str
    amount: int
    status: str
    paid_at: KSTDatetime
    refunded_at: KSTDatetime | None


class AdminReservationOut(ReservationOut):
    user_email: str | None
    cancelled_by: str | None
    payment: PaymentOut | None


class ReservationPage(BaseModel):
    items: list[ReservationOut]
    total: int
    page: int
    size: int


class TimelineItem(ORM):
    id: int
    type: Literal["DAYUSE", "STAY", "BLOCK"]
    start_at: KSTDatetime
    end_at: KSTDatetime
    blocked_until: KSTDatetime
    guest_name: str
    block_reason: str | None


class DashboardOut(BaseModel):
    today_check_ins: int
    today_check_outs: int
    week_reservations: int
    month_revenue: int
    today_timeline: list[TimelineItem]
    upcoming: list[ReservationOut]


class SettingsIn(PublicRules):
    """All twelve rule fields; validated for internal consistency."""

    model_config = ConfigDict(from_attributes=True)

    dayuse_weekday_price: int = Field(gt=0)
    dayuse_weekend_price: int = Field(gt=0)
    stay_weekday_price: int = Field(gt=0)
    stay_weekend_price: int = Field(gt=0)
    dayuse_first_start_hour: int = Field(ge=0, le=23)
    dayuse_last_start_hour: int = Field(ge=0, le=23)
    dayuse_hours: int = Field(ge=1, le=12)
    stay_check_in_hour: int = Field(ge=0, le=23)
    stay_check_out_hour: int = Field(ge=0, le=23)
    stay_max_nights: int = Field(ge=1, le=30)
    cleaning_buffer_minutes: int = Field(ge=0, le=240)
    guest_cancel_deadline_hours: int = Field(ge=0, le=168)

    @model_validator(mode="after")
    def _consistent(self):
        if self.dayuse_first_start_hour > self.dayuse_last_start_hour:
            raise ValueError("dayuse_first_start_hour must be <= dayuse_last_start_hour")
        if self.stay_check_out_hour >= self.stay_check_in_hour:
            raise ValueError("stay_check_out_hour must be < stay_check_in_hour")
        return self


class BlockIn(BaseModel):
    start_at: AwareDatetime
    end_at: AwareDatetime
    reason: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def _ordered(self):
        if self.start_at >= self.end_at:
            raise ValueError("start_at must be before end_at")
        return self


class BlockOut(BaseModel):
    id: int
    start_at: KSTDatetime
    end_at: KSTDatetime
    reason: str


class RoomIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(max_length=2000)
    capacity: int = Field(ge=1, le=10)
    bed: str = Field(min_length=1, max_length=50)
    size_m2: int = Field(ge=1, le=500)
    amenities: list[Annotated[str, Field(min_length=1, max_length=30)]] = Field(max_length=20)
