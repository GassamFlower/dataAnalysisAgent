"""教程模块 API 路由。"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_current_user_optional, get_db, require_admin
from app.core.exceptions import NotFoundException
from app.core.error_messages import ERR_TUTORIAL_NOT_FOUND
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
    AIInterpretRequest,
    AIInterpretResponse,
)
from app.services.tutorial_service import TutorialService
from app.services.quota_service import check_and_consume_quota, get_quota_status
from app.services.project_service import get_owned_project

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
    tag: Optional[str] = Query(None, description="标签筛选"),
    difficulty: Optional[str] = Query(None, description="难度筛选（beginner/intermediate/advanced）"),
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
        tag=tag,
        difficulty=difficulty,
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
        raise NotFoundException(ERR_TUTORIAL_NOT_FOUND)
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


# ========== AI 解读助手（阶段三）==========

@router.get(
    "/ai-interpret/quota",
    response_model=ResponseModel[dict],
    summary="查询 AI 解读剩余额度",
    description="查询当前用户本周剩余的 AI 解读次数。",
)
async def get_ai_interpret_quota(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """查询 AI 解读剩余额度。"""
    status = await get_quota_status(db, current_user["id"], current_user["plan"])
    ai_quota = status["quotas"].get("ai_interpret", {})
    return ResponseModel(data=ai_quota)


@router.post(
    "/ai-interpret/{project_id}",
    response_model=ResponseModel[AIInterpretResponse],
    summary="生成 AI 解读",
    description="基于项目最新报告，调用 LLM 生成通俗解读与论文写作建议。免费用户 1 次/周。",
)
async def ai_interpret(
    project_id: UUID,
    request: AIInterpretRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """生成 AI 解读。

    流程：
    1. 校验并扣减免费额度（ai_interpret 类型，免费用户 1 次/周）
    2. 调用 TutorialService.ai_interpret 读取报告 + 调用 LLM
    3. 查询剩余额度并返回
    """
    # 1. 归属校验：项目必须属于当前用户（防 IDOR，禁止跨用户读取他人报告）
    await get_owned_project(db, project_id, current_user["id"])

    # 1.5 校验并扣减额度（归属校验通过后才扣，避免无效请求浪费额度）
    await check_and_consume_quota(
        db,
        current_user["id"],
        "ai_interpret",
        current_user["plan"],
        current_user.get("plan_expires_at"),
    )

    # 2. 生成解读
    result = await TutorialService.ai_interpret(
        db=db,
        project_id=project_id,
        question=request.question,
        section=request.section,
    )

    # 3. 查询剩余额度
    status = await get_quota_status(db, current_user["id"], current_user["plan"])
    remaining = status["quotas"].get("ai_interpret", {}).get("remaining", 0)

    return ResponseModel(
        data=AIInterpretResponse(
            project_id=UUID(result["project_id"]),
            content=result["content"],
            section=result["section"],
            question=result["question"],
            quota_remaining=remaining,
        )
    )
