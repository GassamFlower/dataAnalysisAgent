"""add_users_refresh_token

Revision ID: b8318b614246
Revises: 529298d9839d
Create Date: 2026-07-18 15:25:16.328311

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8318b614246'
down_revision: Union[str, None] = '529298d9839d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('refresh_token', sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('users', 'refresh_token')
