"""add_tutorial_article_tags_and_difficulty

Revision ID: f3c6d7e8a9b0
Revises: e1a4b5c2d6f7
Create Date: 2026-08-24 12:00:00.000000

为教程文章（统计知识小课堂 F-TUT-002）增加：
- tags：标签列表（JSON 文本，支持列表页标签筛选）
- difficulty：难度（beginner / intermediate / advanced）
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3c6d7e8a9b0'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tutorial_articles',
        sa.Column('tags', sa.Text(), nullable=True, comment='标签列表（JSON 数组字符串，如 ["信度","效度"]）'),
    )
    op.add_column(
        'tutorial_articles',
        sa.Column('difficulty', sa.String(20), nullable=True, comment='难度：beginner / intermediate / advanced'),
    )
    op.create_index('idx_tutorial_articles_tags', 'tutorial_articles', ['tags'])
    op.create_index('idx_tutorial_articles_difficulty', 'tutorial_articles', ['difficulty'])


def downgrade() -> None:
    op.drop_index('idx_tutorial_articles_difficulty', table_name='tutorial_articles')
    op.drop_index('idx_tutorial_articles_tags', table_name='tutorial_articles')
    op.drop_column('tutorial_articles', 'difficulty')
    op.drop_column('tutorial_articles', 'tags')