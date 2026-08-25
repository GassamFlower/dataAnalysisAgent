"""学科量表库模型（3NF，Task 4.1）。

三张表满足 1NF/2NF/3NF：
- research_scales：量表主表（名称/学科/计分/来源/信效度引用）。主键 id，其余非键字段函数依赖主键。
- scale_dimensions：维度，外键 scale_id → research_scales.id；维度名函数依赖维度主键，消除部分依赖。
- scale_items：条目，外键 dimension_id → scale_dimensions.id；条目标题/反向标记依赖条目主键，无传递依赖。

来源 reference 均为已公开量表的出处，信效度引用指向其信度报告/量表中文献。
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import String, Text, Integer, Boolean, ForeignKey, Index, UniqueConstraint, CheckConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class ResearchScale(Base):
    """公开学科量表（量表库条目）。"""

    __tablename__ = "research_scales"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_research_scales_slug"),
        CheckConstraint(
            "discipline IN ('management', 'education', 'psychology')",
            name="ck_research_scales_discipline",
        ),
        CheckConstraint(
            "is_published IN (0, 1)", name="ck_research_scales_is_published"
        ),
        Index("idx_research_scales_discipline", "discipline"),
        Index("idx_research_scales_deleted_at", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    discipline: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # 计分方式：正向/反向计分、维度均分或总分、五级量表等
    scoring_method: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # 来源与信效度引用（出处，非系统结论）
    source: Mapped[Optional[str]] = mapped_column(Text)
    reliability_ref: Mapped[Optional[str]] = mapped_column(Text)
    validity_ref: Mapped[Optional[str]] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    dimensions: Mapped[List["ScaleDimension"]] = relationship(
        back_populates="scale",
        cascade="all, delete-orphan",
        order_by="ScaleDimension.index",
    )


class ScaleDimension(Base):
    """量表的维度（因子）。"""

    __tablename__ = "scale_dimensions"
    __table_args__ = (
        Index("idx_scale_dimensions_scale_id", "scale_id"),
        UniqueConstraint("scale_id", "index", name="uq_scale_dimensions_scale_index"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    scale_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("research_scales.id", ondelete="CASCADE"), nullable=False
    )
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )

    scale: Mapped["ResearchScale"] = relationship(back_populates="dimensions")
    items: Mapped[List["ScaleItem"]] = relationship(
        back_populates="dimension",
        cascade="all, delete-orphan",
        order_by="ScaleItem.index",
    )


class ScaleItem(Base):
    """维度下的量表条目（题目）。"""

    __tablename__ = "scale_items"
    __table_args__ = (
        Index("idx_scale_items_dimension_id", "dimension_id"),
        UniqueConstraint("dimension_id", "index", name="uq_scale_items_dimension_index"),
        CheckConstraint("is_reverse IN (0, 1)", name="ck_scale_items_is_reverse"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    dimension_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("scale_dimensions.id", ondelete="CASCADE"), nullable=False
    )
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_reverse: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )

    dimension: Mapped["ScaleDimension"] = relationship(back_populates="items")