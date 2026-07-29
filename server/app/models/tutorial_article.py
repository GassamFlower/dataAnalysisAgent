"""教程文章模型。"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, Boolean, Integer, Index, UniqueConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, UTCDateTime


class TutorialArticle(Base):
    """教程文章（统计知识小课堂 F-TUT-002）。"""

    __tablename__ = "tutorial_articles"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_tutorial_articles_slug"),
        Index("idx_tutorial_articles_slug", "slug"),
        Index("idx_tutorial_articles_category", "category"),
        Index("idx_tutorial_articles_is_published", "is_published"),
        Index("idx_tutorial_articles_order_index", "order_index"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    slug: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True,
        comment="URL 友好标识（如 reliability-validity）"
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="教程标题"
    )
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="分类：basics / methods / writing"
    )
    content_markdown: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Markdown 内容"
    )
    summary: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="摘要（列表页展示）"
    )
    cover_image: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="封面图 URL"
    )
    order_index: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="排序索引"
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否发布"
    )
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        default=datetime.now(timezone.utc),
        onupdate=datetime.now(timezone.utc),
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        UTCDateTime, nullable=True, comment="软删除时间"
    )
