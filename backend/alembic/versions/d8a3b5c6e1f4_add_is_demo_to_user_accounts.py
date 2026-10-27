"""Add is_demo to user_accounts

Revision ID: d8a3b5c6e1f4
Revises: c4d1e7f2a9b3
Create Date: 2026-10-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8a3b5c6e1f4'
down_revision: Union[str, Sequence[str], None] = 'c4d1e7f2a9b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_accounts',
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('user_accounts', 'is_demo')
