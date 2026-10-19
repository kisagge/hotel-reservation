from pydantic import BaseModel, ConfigDict, EmailStr, Field


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
