"""admin_permissions 表 + users.is_super_admin

Revision ID: a1b2c3d4e5f6
Revises: d0e1f2b3c4d5
Create Date: 2026-09-04 18:00:00.000000

管理后台模块级授权（F-ADM-001 增强）：
- users 新增 is_super_admin：超管拥有全部后台模块，且可授权/撤销子管理员。
- 新增 admin_permissions：子管理员（is_admin=True 且非超管）被授予的模块清单。
兼容策略：现有 is_admin=True 的账号全部视为超管，保证升级后权限不回退。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd0e1f2b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('is_super_admin', sa.Boolean(), nullable=False, server_default='0'),
    )
    # 兼容：既有 is_admin 账号全部晋升为超管（不改变其现有全部权限）
    op.execute("UPDATE users SET is_super_admin = 1 WHERE is_admin = 1")

    op.create_table(
        'admin_permissions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('module', sa.String(length=30), nullable=False),
        sa.Column('created_by', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'module', name='uq_admin_perm_user_module'),
    )
    op.create_index('idx_admin_permissions_user', 'admin_permissions', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_admin_permissions_user', table_name='admin_permissions')
    op.drop_table('admin_permissions')
    op.drop_column('users', 'is_super_admin')
