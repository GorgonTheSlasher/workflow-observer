"""Add delivery_id to github_events

Revision ID: c4d1e7f2a9b3
Revises: a3f92c1d8e45
Create Date: 2026-10-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d1e7f2a9b3'
down_revision: Union[str, Sequence[str], None] = 'a3f92c1d8e45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('github_events', sa.Column('delivery_id', sa.String(), nullable=True))
    op.create_index('ix_github_events_delivery_id', 'github_events', ['delivery_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_github_events_delivery_id', table_name='github_events')
    op.drop_column('github_events', 'delivery_id')
