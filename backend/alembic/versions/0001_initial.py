"""initial

Revision ID: 0001
Revises: 
Create Date: 2026-10-19 12:50:51.366579

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.create_table('rooms',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('description', sa.Text(), server_default='', nullable=False),
    sa.Column('capacity', sa.Integer(), nullable=False),
    sa.Column('bed', sa.String(length=50), nullable=False),
    sa.Column('size_m2', sa.Integer(), nullable=False),
    sa.Column('amenities', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('name', sa.String(length=30), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=False),
    sa.Column('role', sa.String(length=10), server_default='USER', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("role IN ('USER','ADMIN')", name='users_role'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('reservations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=20), nullable=True),
    sa.Column('room_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('type', sa.String(length=10), nullable=False),
    sa.Column('status', sa.String(length=10), server_default='CONFIRMED', nullable=False),
    sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('end_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('blocked_until', sa.DateTime(timezone=True), nullable=False),
    sa.Column('nights', sa.Integer(), nullable=True),
    sa.Column('guest_name', sa.String(length=30), server_default='', nullable=False),
    sa.Column('guest_phone', sa.String(length=20), nullable=True),
    sa.Column('block_reason', sa.String(length=100), nullable=True),
    sa.Column('total_price', sa.Integer(), server_default='0', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancelled_by', sa.String(length=10), nullable=True),
    sa.CheckConstraint("cancelled_by IS NULL OR cancelled_by IN ('GUEST','ADMIN')", name='reservations_cancelled_by'),
    sa.CheckConstraint("status IN ('CONFIRMED','CANCELLED')", name='reservations_status'),
    sa.CheckConstraint("type IN ('DAYUSE','STAY','BLOCK')", name='reservations_type'),
    sa.CheckConstraint('start_at < end_at AND end_at <= blocked_until', name='reservations_window'),
    sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code')
    )
    op.create_table('room_photos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('room_id', sa.Integer(), nullable=False),
    sa.Column('url', sa.String(length=255), nullable=False),
    sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
    sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('room_settings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('room_id', sa.Integer(), nullable=False),
    sa.Column('dayuse_weekday_price', sa.Integer(), nullable=False),
    sa.Column('dayuse_weekend_price', sa.Integer(), nullable=False),
    sa.Column('stay_weekday_price', sa.Integer(), nullable=False),
    sa.Column('stay_weekend_price', sa.Integer(), nullable=False),
    sa.Column('dayuse_first_start_hour', sa.Integer(), nullable=False),
    sa.Column('dayuse_last_start_hour', sa.Integer(), nullable=False),
    sa.Column('dayuse_hours', sa.Integer(), nullable=False),
    sa.Column('stay_check_in_hour', sa.Integer(), nullable=False),
    sa.Column('stay_check_out_hour', sa.Integer(), nullable=False),
    sa.Column('stay_max_nights', sa.Integer(), nullable=False),
    sa.Column('cleaning_buffer_minutes', sa.Integer(), nullable=False),
    sa.Column('guest_cancel_deadline_hours', sa.Integer(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('room_id')
    )
    op.create_table('payments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('reservation_id', sa.Integer(), nullable=False),
    sa.Column('provider', sa.String(length=20), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=10), server_default='PAID', nullable=False),
    sa.Column('paid_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("status IN ('PAID','REFUNDED')", name='payments_status'),
    sa.ForeignKeyConstraint(['reservation_id'], ['reservations.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('reservation_id')
    )
    # One room can never hold two CONFIRMED rows whose [start_at, blocked_until) ranges overlap.
    op.execute(
        "ALTER TABLE reservations ADD CONSTRAINT reservations_no_overlap "
        "EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, blocked_until, '[)') WITH &&) "
        "WHERE (status = 'CONFIRMED')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('payments')
    op.drop_table('room_settings')
    op.drop_table('room_photos')
    op.drop_table('reservations')
    op.drop_table('users')
    op.drop_table('rooms')
