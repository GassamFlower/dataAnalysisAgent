"""add users.disabled_at for admin disable (F-ADM-001)

Revision ID: ab12cd34ef56
Revises: f3c6d7e8a9b0
Create Date: 2026-08-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'abf2c1011234'
down_revision: Union[str, None] = 'f3c6d7e8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 管理后台禁用账号（非空即禁用，登录/鉴权均拒绝）
    op.add_column(
        'users',
        sa.Column('disabled_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'disabled_at')