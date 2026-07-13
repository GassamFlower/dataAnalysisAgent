"""add datasets table

Revision ID: 8f3a2c1d9e7b
Revises: dfbbbf4dfadf
Create Date: 2026-07-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8f3a2c1d9e7b'
down_revision: Union[str, None] = 'dfbbbf4dfadf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'datasets',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('simulation_config_id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('sample_size', sa.Integer(), nullable=False),
        sa.Column('columns', sa.JSON(), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.ForeignKeyConstraint(['simulation_config_id'], ['simulation_configs.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('simulation_config_id'),
    )
    op.create_index(
        'idx_datasets_simulation_config_id',
        'datasets',
        ['simulation_config_id'],
        unique=True,
    )
    op.create_index(
        'idx_datasets_project_id',
        'datasets',
        ['project_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('idx_datasets_project_id', table_name='datasets')
    op.drop_index('idx_datasets_simulation_config_id', table_name='datasets')
    op.drop_table('datasets')
