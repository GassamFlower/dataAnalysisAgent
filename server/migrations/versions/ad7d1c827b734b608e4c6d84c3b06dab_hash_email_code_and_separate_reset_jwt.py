"""hash email code and separate reset jwt

Revision ID: ad7d1c827b73
Revises: b8318b614246
Create Date: 2026-07-19 07:36:00.000000

"""
import sys
from pathlib import Path

# 将 server 目录加入 sys.path，确保 alembic 加载迁移脚本时能导入 app 包
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ad7d1c827b734b608e4c6d84c3b06dab'
down_revision: Union[str, None] = 'b8318b614246'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 将邮箱验证码字段重命名为哈希字段，并扩长以存储 bcrypt 哈希
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column(
            'email_verify_code',
            new_column_name='email_verify_code_hash',
            type_=sa.String(length=255),
            existing_type=sa.String(length=10),
            existing_nullable=True,
        )

    # 历史明文验证码直接清空，避免与新逻辑冲突
    op.execute("UPDATE users SET email_verify_code_hash = NULL")


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column(
            'email_verify_code_hash',
            new_column_name='email_verify_code',
            type_=sa.String(length=10),
            existing_type=sa.String(length=255),
            existing_nullable=True,
        )
