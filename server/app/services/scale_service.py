"""学科量表库业务逻辑服务（Task 4.1 / 4.3）。

负责公开量表的列表检索与详情查询。所有查询仅返回 `is_published=True` 且未软删除的量表。
"""
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.research_scale import ResearchScale, ScaleDimension, ScaleItem
from app.schemas.scale import (
    ScaleDetail,
    ScaleDimensionOut,
    ScaleItemOut,
    ScaleListItem,
    ScaleListResponse,
)


class ScaleService:
    """学科量表库服务。"""

    DISCIPLINES = ("management", "education", "psychology")

    @staticmethod
    def _dimension_out(dim: ScaleDimension) -> ScaleDimensionOut:
        """将维度 ORM 模型转为响应 schema。"""
        return ScaleDimensionOut(
            index=dim.index,
            name=dim.name,
            items=[
                ScaleItemOut(index=it.index, text=it.text, is_reverse=it.is_reverse)
                for it in dim.items
            ],
        )

    @staticmethod
    async def get_scale_detail(db: AsyncSession, slug: str) -> Optional[ScaleDetail]:
        """按 slug 查询已发布的量表详情（含维度与条目）。"""
        result = await db.execute(
            select(ResearchScale)
            .options(
                selectinload(ResearchScale.dimensions).selectinload(ScaleDimension.items)
            )
            .where(
                ResearchScale.slug == slug,
                ResearchScale.is_published.is_(True),
                ResearchScale.deleted_at.is_(None),
            )
        )
        scale = result.scalar_one_or_none()
        if not scale:
            return None
        return ScaleDetail(
            id=scale.id,
            slug=scale.slug,
            name=scale.name,
            discipline=scale.discipline,
            description=scale.description,
            scoring_method=scale.scoring_method,
            source=scale.source,
            reliability_ref=scale.reliability_ref,
            validity_ref=scale.validity_ref,
            dimensions=[ScaleService._dimension_out(d) for d in scale.dimensions],
        )

    @staticmethod
    async def list_scales(
        db: AsyncSession,
        discipline: Optional[str] = None,
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 12,
    ) -> ScaleListResponse:
        """分页检索已发布的量表。

        支持按学科筛选与关键词（名称/简介）搜索。
        """
        stmt = select(ResearchScale).where(
            ResearchScale.is_published.is_(True),
            ResearchScale.deleted_at.is_(None),
        )

        if discipline in ScaleService.DISCIPLINES:
            stmt = stmt.where(ResearchScale.discipline == discipline)

        if keyword:
            like_pattern = f"%{keyword}%"
            stmt = stmt.where(
                or_(
                    ResearchScale.name.ilike(like_pattern),
                    ResearchScale.description.ilike(like_pattern),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar() or 0

        stmt = stmt.order_by(
            ResearchScale.discipline, ResearchScale.name, ResearchScale.created_at
        )
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(stmt)
        scales = result.scalars().all()

        return ScaleListResponse(
            items=[
                ScaleListItem(
                    id=s.id,
                    slug=s.slug,
                    name=s.name,
                    discipline=s.discipline,
                    description=s.description,
                    source=s.source,
                    reliability_ref=s.reliability_ref,
                    validity_ref=s.validity_ref,
                )
                for s in scales
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    async def get_scale_detail_by_id(db: AsyncSession, scale_id) -> Optional[ResearchScale]:
        """按 ID 查询已发布的量表 ORM 模型（含维度/条目），供项目创建联动使用。"""
        result = await db.execute(
            select(ResearchScale)
            .options(
                selectinload(ResearchScale.dimensions).selectinload(ScaleDimension.items)
            )
            .where(
                ResearchScale.id == scale_id,
                ResearchScale.is_published.is_(True),
                ResearchScale.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()