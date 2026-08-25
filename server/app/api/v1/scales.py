"""学科量表库公开 API（Task 4.1 / 4.3）。

量表库面向公开浏览（营销页展示），无需登录即可检索与查看详情。
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.error_messages import ERR_SCALE_NOT_FOUND
from app.core.exceptions import NotFoundException
from app.core.responses import ResponseModel
from app.schemas.scale import ScaleDetail, ScaleListResponse
from app.services.scale_service import ScaleService

router = APIRouter(prefix="/scales", tags=["scales"])


@router.get(
    "",
    response_model=ResponseModel[ScaleListResponse],
    summary="量表列表",
    description="公开分页检索已发布的学科量表，支持学科筛选与关键词搜索。",
)
async def list_scales(
    discipline: Optional[str] = Query(None, description="学科筛选：management/education/psychology"),
    keyword: Optional[str] = Query(None, description="搜索关键词（名称/简介）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(12, ge=1, le=50, description="每页数量"),
    db: AsyncSession = Depends(get_db),
):
    result = await ScaleService.list_scales(
        db=db, discipline=discipline, keyword=keyword, page=page, page_size=page_size
    )
    return ResponseModel(data=result)


@router.get(
    "/{slug}",
    response_model=ResponseModel[ScaleDetail],
    summary="量表详情",
    description="按 slug 获取单条量表详情（含维度与条目）。",
)
async def get_scale(slug: str, db: AsyncSession = Depends(get_db)):
    scale = await ScaleService.get_scale_detail(db, slug)
    if not scale:
        raise NotFoundException(ERR_SCALE_NOT_FOUND)
    return ResponseModel(data=scale)