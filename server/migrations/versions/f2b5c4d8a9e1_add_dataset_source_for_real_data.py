"""add_dataset_source_for_real_data

Revision ID: f2b5c4d8a9e1
Revises: e1a4b5c2d6f7
Create Date: 2026-07-21 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2b5c4d8a9e1'
down_revision: Union[str, None] = 'e1a4b5c2d6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. 添加 source 字段（可空）
    op.add_column(
        'datasets',
        sa.Column('source', sa.String(length=20), nullable=True)
    )

    # 2. 回填旧数据为 simulation
    op.execute("UPDATE datasets SET source = 'simulation'")

    # 3. SQLite 不支持直接 ALTER COLUMN，使用 batch_alter_table 重建表
    with op.batch_alter_table('datasets') as batch_op:
        # 将 source 改为非空并设置默认值
        batch_op.alter_column(
            'source',
            existing_type=sa.String(length=20),
            nullable=False,
            server_default=sa.text("'simulation'")
        )
        # 将 simulation_config_id 改为可空
        batch_op.alter_column(
            'simulation_config_id',
            existing_type=sa.Uuid(),
            nullable=True
        )
        # 删除原唯一约束
        batch_op.drop_constraint('uq_datasets_simulation_config_id', type_='unique')

    # 4. 创建 partial unique index：仅 simulation 数据要求 simulation_config_id 唯一
    #    SQLite 与 PostgreSQL 均支持 WHERE 子句的 unique index
    op.execute(
        "CREATE UNIQUE INDEX idx_datasets_simulation_config_id_unique "
        "ON datasets (simulation_config_id) WHERE source = 'simulation'"
    )

    # 5. 创建 project_id + source 索引
    op.create_index(
        'idx_datasets_project_id_source',
        'datasets',
        ['project_id', 'source']
    )


def downgrade() -> None:
    # 1. 删除新索引
    op.drop_index('idx_datasets_project_id_source', table_name='datasets')
    op.execute("DROP INDEX IF EXISTS idx_datasets_simulation_config_id_unique")

    # 2. 使用 batch_alter_table 恢复约束与字段属性
    with op.batch_alter_table('datasets') as batch_op:
        # 恢复 simulation_config_id 唯一约束
        batch_op.create_unique_constraint(
            'uq_datasets_simulation_config_id',
            ['simulation_config_id']
        )
        # 恢复 simulation_config_id 非空
        batch_op.alter_column(
            'simulation_config_id',
            existing_type=sa.Uuid(),
            nullable=False
        )

    # 3. 删除 source 字段
    op.drop_column('datasets', 'source')
