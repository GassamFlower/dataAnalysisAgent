"""教程模块 API 路由。"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_current_user_optional, get_db, require_admin
from app.core.exceptions import NotFoundException
from app.core.responses import ResponseModel
from app.schemas.tutorial import (
    MetricTooltipResponse,
    OnboardingStartRequest,
    OnboardingStartResponse,
    TutorialProgressResponse,
    TutorialProgressUpdateRequest,
    TutorialProgressUpdateResponse,
    TutorialArticleCreateRequest,
    TutorialArticleUpdateRequest,
    TutorialArticleResponse,
    TutorialArticleListResponse,
)
from app.services.tutorial_service import TutorialService

router = APIRouter(prefix="/tutorial", tags=["tutorial"])


@router.get(
    "/progress",
    response_model=ResponseModel[TutorialProgressResponse],
    summary="获取引导进度",
    description="获取当前用户的新手引导进度状态。",
)
async def get_progress(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """获取用户引导进度。"""
    progress = await TutorialService.get_progress(db, current_user["id"])
    return ResponseModel(data=progress)


@router.post(
    "/progress",
    response_model=ResponseModel[TutorialProgressUpdateResponse],
    summary="更新引导进度",
    description="更新当前用户的新手引导进度。",
)
async def update_progress(
    request: TutorialProgressUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """更新用户引导进度。"""
    result = await TutorialService.update_progress(
        db, current_user["id"], request.step, request.completed
    )
    return ResponseModel(data=result)


@router.get(
    "/metric-tooltip/{metric_type}",
    response_model=ResponseModel[MetricTooltipResponse],
    summary="获取指标解读",
    description="获取指定统计指标的通俗解读内容。",
)
async def get_metric_tooltip(
    metric_type: str,
    current_user: dict = Depends(get_current_user),
):
    """获取指标解读内容。"""
    tooltip = TutorialService.get_metric_tooltip(metric_type)
    if not tooltip:
        raise NotFoundException(f"指标类型 '{metric_type}' 不存在")
    return ResponseModel(data=tooltip)


@router.get(
    "/metric-types",
    response_model=ResponseModel[List[str]],
    summary="获取所有指标类型",
    description="获取系统支持的所有指标类型列表。",
)
async def get_metric_types(
    current_user: dict = Depends(get_current_user),
):
    """获取所有支持的指标类型。"""
    types = TutorialService.get_all_metric_types()
    return ResponseModel(data=types)


@router.post(
    "/onboarding/start",
    response_model=ResponseModel[OnboardingStartResponse],
    summary="启动引导流程",
    description="启动新手引导流程，返回引导步骤列表。",
)
async def start_onboarding(
    request: OnboardingStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """启动引导流程。"""
    result = await TutorialService.start_onboarding(
        db, current_user["id"], request.project_id
    )
    return ResponseModel(data=result)


@router.post(
    "/progress/reset",
    response_model=ResponseModel[dict],
    summary="重置引导进度",
    description="重置当前用户的新手引导进度（用于重新播放引导）。",
)
async def reset_progress(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """重置用户引导进度。"""
    result = await TutorialService.reset_progress(db, current_user["id"])
    return ResponseModel(data={"success": result})


# ========== 教程文章（统计知识小课堂）==========

@router.get(
    "/articles",
    response_model=ResponseModel[TutorialArticleListResponse],
    summary="获取教程列表",
    description="分页获取教程文章列表，支持分类筛选和搜索。",
)
async def list_articles(
    category: Optional[str] = Query(None, description="分类筛选"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(12, ge=1, le=50, description="每页数量"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """获取教程文章列表。

    公开端点：未登录用户可查看已发布教程，管理员可查看未发布教程。
    """
    is_admin = current_user.get("is_admin", False) if current_user else False
    result = await TutorialService.list_articles(
        db=db,
        category=category,
        keyword=keyword,
        page=page,
        page_size=page_size,
        include_unpublished=is_admin,
    )
    return ResponseModel(data=result)


@router.get(
    "/articles/{slug}",
    response_model=ResponseModel[TutorialArticleResponse],
    summary="获取教程详情",
    description="根据 slug 获取单篇教程详情。",
)
async def get_article(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """根据 slug 获取教程详情。

    公开端点：未登录用户可查看已发布教程，管理员可查看未发布教程。
    """
    is_admin = current_user.get("is_admin", False) if current_user else False
    article = await TutorialService.get_article_by_slug(
        db, slug, include_unpublished=is_admin
    )
    if not article:
        raise NotFoundException("教程不存在")
    return ResponseModel(data=article)


@router.post(
    "/admin/articles",
    response_model=ResponseModel[TutorialArticleResponse],
    summary="创建教程（管理员）",
    description="管理员创建新的教程文章。",
)
async def create_article(
    request: TutorialArticleCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """创建教程文章（管理员）。"""
    article = await TutorialService.create_article(db, request)
    return ResponseModel(data=article)


@router.put(
    "/admin/articles/{article_id}",
    response_model=ResponseModel[TutorialArticleResponse],
    summary="更新教程（管理员）",
    description="管理员更新教程文章。",
)
async def update_article(
    article_id: UUID,
    request: TutorialArticleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """更新教程文章（管理员）。"""
    article = await TutorialService.update_article(db, article_id, request)
    return ResponseModel(data=article)


@router.delete(
    "/admin/articles/{article_id}",
    response_model=ResponseModel[dict],
    summary="删除教程（管理员）",
    description="管理员软删除教程文章。",
)
async def delete_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """删除教程文章（管理员）。"""
    result = await TutorialService.delete_article(db, article_id)
    return ResponseModel(data={"success": result})
