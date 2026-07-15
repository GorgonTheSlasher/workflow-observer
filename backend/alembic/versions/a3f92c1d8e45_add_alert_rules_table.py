"""Add alert_rules table

Revision ID: a3f92c1d8e45
Revises: 67838d34bcfa
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f92c1d8e45'
down_revision: Union[str, Sequence[str], None] = '67838d34bcfa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'alert_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('rule_type', sa.String(), nullable=False),
        sa.Column('repo_filter', sa.String(), nullable=True),
        sa.Column('threshold', sa.Integer(), nullable=True),
        sa.Column('threshold_window_minutes', sa.Integer(), nullable=True),
        sa.Column('webhook_url', sa.String(), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('alert_rules')
