"""integrity checks and indexes for hot queries

- Shape/state CHECKs so every row is a valid DAYUSE, STAY or BLOCK and cancel/refund state is consistent.
- room_settings ranges (mirrors SettingsIn) incl. turnover: check-out + cleaning buffer must fit before check-in.
- Indexes: per-user list, admin/dashboard date range, upcoming blocks, trigram search, room photo order.
  (Availability already has the GiST index behind reservations_no_overlap; the query now uses it.)

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

KIND_SHAPE = (
    "(type = 'BLOCK' AND user_id IS NULL AND total_price = 0 AND nights IS NULL AND block_reason IS NOT NULL"
    " AND cancel_deadline_at IS NULL AND end_at = blocked_until)"
    " OR (type = 'DAYUSE' AND nights IS NULL AND block_reason IS NULL AND cancel_deadline_at IS NOT NULL AND guest_name <> '')"
    " OR (type = 'STAY' AND nights IS NOT NULL AND nights >= 1 AND block_reason IS NULL AND cancel_deadline_at IS NOT NULL AND guest_name <> '')"
)
CANCEL_STATE = "(status = 'CANCELLED') = (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)"
SETTINGS = {
    "room_settings_prices": "dayuse_weekday_price > 0 AND dayuse_weekend_price > 0 AND stay_weekday_price > 0 AND stay_weekend_price > 0",
    "room_settings_dayuse": "dayuse_first_start_hour BETWEEN 0 AND 23 AND dayuse_last_start_hour BETWEEN dayuse_first_start_hour AND 23"
                            " AND dayuse_hours BETWEEN 1 AND 12",
    "room_settings_stay": "stay_check_out_hour BETWEEN 0 AND 23 AND stay_check_in_hour BETWEEN 0 AND 23 AND stay_max_nights BETWEEN 1 AND 30",
    "room_settings_policy": "cleaning_buffer_minutes BETWEEN 0 AND 240 AND guest_cancel_deadline_hours BETWEEN 0 AND 168",
    "room_settings_turnover": "stay_check_out_hour * 60 + cleaning_buffer_minutes <= stay_check_in_hour * 60",
}


def upgrade() -> None:
    # Backfill rows that predate the new rules.
    op.execute("UPDATE payments p SET refunded_at = COALESCE(r.cancelled_at, p.paid_at) FROM reservations r"
               " WHERE p.reservation_id = r.id AND p.status = 'REFUNDED' AND p.refunded_at IS NULL")
    op.execute("UPDATE users SET email = lower(email) WHERE email <> lower(email)")

    op.create_check_constraint("reservations_kind_shape", "reservations", KIND_SHAPE)
    op.create_check_constraint("reservations_cancel_state", "reservations", CANCEL_STATE)
    op.create_check_constraint("reservations_price_nonneg", "reservations", "total_price >= 0")
    op.create_check_constraint("payments_amount_nonneg", "payments", "amount >= 0")
    op.create_check_constraint("payments_refund_state", "payments", "(status = 'REFUNDED') = (refunded_at IS NOT NULL)")
    op.create_check_constraint("users_email_lower", "users", "email = lower(email)")
    op.create_check_constraint("rooms_sizes", "rooms", "capacity >= 1 AND size_m2 >= 1")
    for name, expr in SETTINGS.items():
        op.create_check_constraint(name, "room_settings", expr)

    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index("ix_reservations_user_start", "reservations", ["user_id", "start_at"])
    op.create_index("ix_reservations_start_at", "reservations", ["start_at"])
    op.create_index("ix_reservations_blocks_upcoming", "reservations", ["start_at"],
                    postgresql_where="type = 'BLOCK' AND status = 'CONFIRMED'")
    for col in ("code", "guest_name", "guest_phone"):
        op.create_index(f"ix_reservations_{col}_trgm", "reservations", [col], postgresql_using="gin",
                        postgresql_ops={col: "gin_trgm_ops"})
    op.create_index("ix_room_photos_room_sort", "room_photos", ["room_id", "sort_order"])


def downgrade() -> None:
    op.drop_index("ix_room_photos_room_sort", "room_photos")
    for col in ("code", "guest_name", "guest_phone"):
        op.drop_index(f"ix_reservations_{col}_trgm", "reservations")
    op.drop_index("ix_reservations_blocks_upcoming", "reservations")
    op.drop_index("ix_reservations_start_at", "reservations")
    op.drop_index("ix_reservations_user_start", "reservations")
    for name in SETTINGS:
        op.drop_constraint(name, "room_settings", type_="check")
    op.drop_constraint("rooms_sizes", "rooms", type_="check")
    op.drop_constraint("users_email_lower", "users", type_="check")
    op.drop_constraint("payments_refund_state", "payments", type_="check")
    op.drop_constraint("payments_amount_nonneg", "payments", type_="check")
    op.drop_constraint("reservations_price_nonneg", "reservations", type_="check")
    op.drop_constraint("reservations_cancel_state", "reservations", type_="check")
    op.drop_constraint("reservations_kind_shape", "reservations", type_="check")
