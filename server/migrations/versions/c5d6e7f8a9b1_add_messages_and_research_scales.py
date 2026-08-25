"""add_messages_and_research_scales

Revision ID: c5d6e7f8a9b1
Revises: abf2c1011234
Create Date: 2026-08-25 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8a9b1'
down_revision: Union[str, None] = 'abf2c1011234'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── messages 留言表（Task 2.1，3NF）──────────────────────────────
    op.create_table(
        'messages',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=True),
        sa.Column('tag', sa.String(length=20), nullable=False),
        sa.Column('data_source', sa.String(length=20), nullable=True),
        sa.Column('entry_point', sa.String(length=40), nullable=True),
        sa.Column('contact', sa.String(length=120), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('handled_by', sa.Uuid(), nullable=True),
        sa.Column('handled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('handle_remark', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['handled_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "tag IN ('presale', 'rescue', 'service', 'incident', 'feedback')",
            name='ck_messages_tag',
        ),
        sa.CheckConstraint(
            "data_source IN ('real', 'simulation') OR data_source IS NULL",
            name='ck_messages_data_source',
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'done')",
            name='ck_messages_status',
        ),
    )
    op.create_index('idx_messages_user_id', 'messages', ['user_id'])
    op.create_index('idx_messages_project_id', 'messages', ['project_id'])
    op.create_index('idx_messages_tag', 'messages', ['tag'])
    op.create_index('idx_messages_status', 'messages', ['status'])
    op.create_index('idx_messages_deleted_at', 'messages', ['deleted_at'])

    # ── research_scales 量表主表（Task 4.1，3NF）──────────────────────
    op.create_table(
        'research_scales',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('discipline', sa.String(length=30), nullable=False),
        sa.Column('description', sa.Text(), nullable=False, server_default=''),
        sa.Column('scoring_method', sa.Text(), nullable=False, server_default=''),
        sa.Column('source', sa.Text(), nullable=True),
        sa.Column('reliability_ref', sa.Text(), nullable=True),
        sa.Column('validity_ref', sa.Text(), nullable=True),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_research_scales_slug'),
        sa.CheckConstraint(
            "discipline IN ('management', 'education', 'psychology')",
            name='ck_research_scales_discipline',
        ),
        sa.CheckConstraint('is_published IN (0, 1)', name='ck_research_scales_is_published'),
    )
    op.create_index('idx_research_scales_discipline', 'research_scales', ['discipline'])
    op.create_index('idx_research_scales_deleted_at', 'research_scales', ['deleted_at'])

    # ── scale_dimensions 量表维度表（3NF 子表）───────────────────────
    op.create_table(
        'scale_dimensions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('scale_id', sa.Uuid(), nullable=False),
        sa.Column('index', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['scale_id'], ['research_scales.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('scale_id', 'index', name='uq_scale_dimensions_scale_index'),
    )
    op.create_index('idx_scale_dimensions_scale_id', 'scale_dimensions', ['scale_id'])

    # ── scale_items 量表条目表（3NF 子表）────────────────────────────
    op.create_table(
        'scale_items',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('dimension_id', sa.Uuid(), nullable=False),
        sa.Column('index', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('is_reverse', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dimension_id'], ['scale_dimensions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('dimension_id', 'index', name='uq_scale_items_dimension_index'),
        sa.CheckConstraint('is_reverse IN (0, 1)', name='ck_scale_items_is_reverse'),
    )
    op.create_index('idx_scale_items_dimension_id', 'scale_items', ['dimension_id'])


def downgrade() -> None:
    op.drop_index('idx_scale_items_dimension_id', table_name='scale_items')
    op.drop_table('scale_items')
    op.drop_index('idx_scale_dimensions_scale_id', table_name='scale_dimensions')
    op.drop_table('scale_dimensions')
    op.drop_index('idx_research_scales_deleted_at', table_name='research_scales')
    op.drop_index('idx_research_scales_discipline', table_name='research_scales')
    op.drop_table('research_scales')
    op.drop_index('idx_messages_deleted_at', table_name='messages')
    op.drop_index('idx_messages_status', table_name='messages')
    op.drop_index('idx_messages_tag', table_name='messages')
    op.drop_index('idx_messages_project_id', table_name='messages')
    op.drop_index('idx_messages_user_id', table_name='messages')
    op.drop_table('messages')