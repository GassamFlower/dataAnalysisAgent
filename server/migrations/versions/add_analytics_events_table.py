"""add analytics_events table

Revision ID: add_analytics
Revises: f2b5c4d8a9e1
Create Date: 2026-07-31 14:43:00

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_analytics'
down_revision = 'f2b5c4d8a9e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 创建 analytics_events 表
    op.create_table(
        'analytics_events',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=True),
        sa.Column('project_id', sa.Uuid(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 创建索引
    op.create_index('ix_analytics_event_type', 'analytics_events', ['event_type'])
    op.create_index('ix_analytics_user_id', 'analytics_events', ['user_id'])
    op.create_index('ix_analytics_project_id', 'analytics_events', ['project_id'])
    op.create_index('ix_analytics_created_at', 'analytics_events', ['created_at'])
    op.create_index('ix_analytics_event_type_created', 'analytics_events', ['event_type', 'created_at'])
    op.create_index('ix_analytics_user_created', 'analytics_events', ['user_id', 'created_at'])


def downgrade() -> None:
    # 删除索引
    op.drop_index('ix_analytics_user_created', table_name='analytics_events')
    op.drop_index('ix_analytics_event_type_created', table_name='analytics_events')
    op.drop_index('ix_analytics_created_at', table_name='analytics_events')
    op.drop_index('ix_analytics_project_id', table_name='analytics_events')
    op.drop_index('ix_analytics_user_id', table_name='analytics_events')
    op.drop_index('ix_analytics_event_type', table_name='analytics_events')

    # 删除表
    op.drop_table('analytics_events')
