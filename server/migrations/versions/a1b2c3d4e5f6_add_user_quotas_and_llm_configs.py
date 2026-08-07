"""add user_quotas and llm_configs tables

Revision ID: a1b2c3d4e5f6
Revises: add_analytics
Create Date: 2026-08-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'add_analytics'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 创建 user_quotas 表（周用量限制，F-SYS-001）
    op.create_table(
        'user_quotas',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('period_key', sa.String(20), nullable=False, comment='YYYY-Www 格式'),
        sa.Column('used_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_count', sa.Integer(), nullable=False, server_default='6'),
        sa.Column('reset_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'action_type', 'period_key', name='uq_user_quota_week'),
    )
    op.create_index('idx_user_quotas_user_period', 'user_quotas', ['user_id', 'period_key'])

    # 创建 llm_configs 表（LLM 模型配置动态切换）
    op.create_table(
        'llm_configs',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('config_key', sa.String(100), nullable=False),
        sa.Column('config_value', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True, server_default=''),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_llm_configs_config_key', 'llm_configs', ['config_key'], unique=True)


def downgrade() -> None:
    # 删除 llm_configs 表
    op.drop_index('ix_llm_configs_config_key', table_name='llm_configs')
    op.drop_table('llm_configs')

    # 删除 user_quotas 表
    op.drop_index('idx_user_quotas_user_period', table_name='user_quotas')
    op.drop_table('user_quotas')
