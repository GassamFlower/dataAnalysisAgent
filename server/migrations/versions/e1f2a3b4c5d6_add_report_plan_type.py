"""add_report_plan_type

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2b3c4d5
Create Date: 2026-10-08 10:00:00.000000

新增 'report' 套餐类型（VIBE 全流程手册 §1 定价锚点对齐）。
users.plan CHECK 约束扩展为 ('free', 'single', 'report', 'subscription')。
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd0e1f2b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.drop_constraint("ck_users_plan", "users", type_="check")
        op.create_check_constraint(
            "ck_users_plan",
            "users",
            "plan IN ('free', 'single', 'report', 'subscription')",
        )
    elif dialect == "sqlite":
        op.execute(
            "UPDATE users SET plan = 'single' WHERE plan NOT IN ('free', 'single', 'report', 'subscription')"
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.drop_constraint("ck_users_plan", "users", type_="check")
        op.create_check_constraint(
            "ck_users_plan",
            "users",
            "plan IN ('free', 'single', 'subscription')",
        )
    elif dialect == "sqlite":
        op.execute(
            "UPDATE users SET plan = 'free' WHERE plan = 'report'"
        )
