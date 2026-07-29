"""add_user_tutorial_progress_table

Revision ID: d8e3f2a1b5c6
Revises: c9f2a3e1b5d7
Create Date: 2026-07-21 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8e3f2a1b5c6'
down_revision: Union[str, None] = 'c9f2a3e1b5d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 创建 user_tutorial_progress 表（教程 F-TUT-004）
    op.create_table(
        'user_tutorial_progress',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('user_id', sa.Uuid(), nullable=False, unique=True),
        sa.Column('current_step', sa.Integer(), nullable=False, server_default='0', comment='当前引导步骤（0 表示未开始）'),
        sa.Column('total_steps', sa.Integer(), nullable=False, server_default='5', comment='总步骤数'),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default=sa.text('0'), comment='是否已完成全部引导'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True, comment='完成时间'),
        sa.Column('step_details', sa.JSON(), nullable=True, comment='各步骤完成状态详情'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', name='uq_user_tutorial_progress_user_id'),
    )
    op.create_index('idx_user_tutorial_progress_user_id', 'user_tutorial_progress', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_user_tutorial_progress_user_id', table_name='user_tutorial_progress')
    op.drop_table('user_tutorial_progress')
