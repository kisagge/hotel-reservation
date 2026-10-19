"""reservation cancel deadline snapshot

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-19 13:10:38.603467

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, Sequence[str], None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('reservations', sa.Column('cancel_deadline_at', sa.DateTime(timezone=True), nullable=True))
    # Existing bookings keep the policy in force today.
    op.execute(
        "UPDATE reservations r SET cancel_deadline_at = r.start_at - make_interval(hours => s.guest_cancel_deadline_hours) "
        "FROM room_settings s WHERE s.room_id = r.room_id AND r.type <> 'BLOCK'"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('reservations', 'cancel_deadline_at')
