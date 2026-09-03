"""add_app_configs

Revision ID: d0e1f2b3c4d5
Revises: c5d6e7f8a9b1
Create Date: 2026-08-25 17:00:00.000000

新增运行时后台可调配置表 app_configs（F-ADM-003 增强）。
当前用途：免费配额各动作周上限的运行时覆盖（key-value，参照 llm_configs）。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0e1f2b3c4d5'
down_revision: Union[str, None] = 'c5d6e7f8a9b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'app_configs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('config_key', sa.String(length=100), nullable=False),
        sa.Column('config_value', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('updated_by', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('config_key', name='uq_app_configs_config_key'),
    )
    op.create_index('idx_app_configs_config_key', 'app_configs', ['config_key'])


def downgrade() -> None:
    op.drop_index('idx_app_configs_config_key', table_name='app_configs')
    op.drop_table('app_configs')