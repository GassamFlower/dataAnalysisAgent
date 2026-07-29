"""add_tutorial_articles_table

Revision ID: e1a4b5c2d6f7
Revises: d8e3f2a1b5c6
Create Date: 2026-07-21 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1a4b5c2d6f7'
down_revision: Union[str, None] = 'd8e3f2a1b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 创建 tutorial_articles 表（教程 F-TUT-002）
    op.create_table(
        'tutorial_articles',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('slug', sa.String(100), nullable=False, unique=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('content_markdown', sa.Text(), nullable=False),
        sa.Column('summary', sa.String(500), nullable=True),
        sa.Column('cover_image', sa.String(500), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('slug', name='uq_tutorial_articles_slug'),
    )
    op.create_index('idx_tutorial_articles_slug', 'tutorial_articles', ['slug'])
    op.create_index('idx_tutorial_articles_category', 'tutorial_articles', ['category'])
    op.create_index('idx_tutorial_articles_is_published', 'tutorial_articles', ['is_published'])
    op.create_index('idx_tutorial_articles_order_index', 'tutorial_articles', ['order_index'])


def downgrade() -> None:
    op.drop_index('idx_tutorial_articles_order_index', table_name='tutorial_articles')
    op.drop_index('idx_tutorial_articles_is_published', table_name='tutorial_articles')
    op.drop_index('idx_tutorial_articles_category', table_name='tutorial_articles')
    op.drop_index('idx_tutorial_articles_slug', table_name='tutorial_articles')
    op.drop_table('tutorial_articles')
