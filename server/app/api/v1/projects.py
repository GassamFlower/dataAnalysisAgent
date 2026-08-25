"""项目路由：项目 CRUD。"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.responses import ResponseModel
from app.core.exceptions import NotFoundException, ValidationException, ForbiddenException
from app.core.error_messages import ERR_PROJECT_NOT_FOUND, ERR_SCALE_NOT_FOUND
from app.models.project import Project
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    ProjectListResponse,
)
from app.schemas.common import PaginatedData
from app.services.project_overview_service import get_project_list_stats, get_project_overview
from app.services.project_service import build_questions_from_scale
from app.services.scale_service import ScaleService
from app.services.audit_service import AuditService, ACTION_TYPES

router = APIRouter(prefix="/projects", tags=["projects"])


MAX_PAGE_SIZE = 100


def _not_deleted():
    """软删除通用过滤条件。"""
    return Project.deleted_at.is_(None)


@router.get(
    "/",
    response_model=ResponseModel[PaginatedData[ProjectListResponse]],
    summary="项目列表",
    description="获取当前用户的项目列表"
)
async def list_projects(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """获取当前用户的项目列表（默认 20 条，最大 100 条）。"""
    if page < 1:
        raise ValidationException("page 必须大于等于 1")
    if page_size < 1:
        raise ValidationException("page_size 必须大于等于 1")
    if page_size > MAX_PAGE_SIZE:
        page_size = MAX_PAGE_SIZE

    base_filter = (
        Project.user_id == current_user["id"],
        _not_deleted(),
    )

    # 查询总数
    count_result = await db.execute(select(Project).where(*base_filter))
    total = len(count_result.scalars().all())

    # 分页查询（eager load questions 用于统计题目数/维度数）
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Project)
        .where(*base_filter)
        .options(selectinload(Project.questions))
        .order_by(Project.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    projects = result.scalars().all()

    # 注入列表展示所需统计字段
    for project in projects:
        stats = await get_project_list_stats(project)
        project.question_count = stats["question_count"]
        project.dimension_count = stats["dimension_count"]

    data = PaginatedData(
        items=projects,
        total=total,
        page=page,
        page_size=page_size
    )
    return ResponseModel(data=data)


@router.post(
    "/",
    response_model=ResponseModel[ProjectResponse],
    status_code=201,
    summary="创建项目",
    description="创建新的预演项目"
)
async def create_project(
    request: ProjectCreate,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """创建新的预演项目。"""
    # 免费用户项目数限制（3 个）
    if current_user["plan"] == "free":
        count_result = await db.execute(
            select(Project).where(
                Project.user_id == current_user["id"],
                Project.deleted_at.is_(None),
            )
        )
        if len(count_result.scalars().all()) >= 3:
            raise ForbiddenException("免费用户最多创建 3 个项目，请升级套餐或清理旧项目")

    project = Project(
        user_id=current_user["id"],
        name=request.name,
        status="draft"
    )

    # 量表联动：选择学科量表后一键建问卷项目，题目来自量表，可直接进入预演
    scale = None
    if request.scale_id:
        scale = await ScaleService.get_scale_detail_by_id(db, request.scale_id)
        if not scale:
            raise NotFoundException(ERR_SCALE_NOT_FOUND)
        project.mode = "simulation"
        project.status = "inspected"  # 题目已就绪，跳过体检，可直接进入假设/预演

    db.add(project)
    await db.flush()
    await db.refresh(project)

    # 由量表条目生成题目
    if scale:
        for q in build_questions_from_scale(project.id, scale):
            db.add(q)
        await db.flush()

    # 记录项目创建审计日志
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["PROJECT_CREATE"],
        project_id=project.id,
        action_detail={"name": request.name, "from_scale": bool(scale)},
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent"),
    )

    if scale:
        # 量表项目：注入真实题目/维度/反向题统计
        all_items = [item for dim in scale.dimensions for item in dim.items]
        project.overview = {
            "question_count": len(all_items),
            "dimension_count": len(scale.dimensions),
            "reverse_count": sum(1 for it in all_items if it.is_reverse),
            "dataset": {"source": "scale", "sample_size": None, "imported_at": None},
            "report": {"has_report": False, "overall_alpha": None, "passed_count": None, "total_count": None, "generated_at": None},
        }
    else:
        # 注入空概览（新建项目无题目/数据集/报告）
        project.overview = {
            "question_count": 0,
            "dimension_count": 0,
            "reverse_count": 0,
            "dataset": {"source": None, "sample_size": None, "imported_at": None},
            "report": {"has_report": False, "overall_alpha": None, "passed_count": None, "total_count": None, "generated_at": None},
        }
    return ResponseModel(data=project)


@router.get(
    "/{project_id}",
    response_model=ResponseModel[ProjectResponse],
    summary="项目详情",
    description="获取项目详情"
)
async def get_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """获取项目详情（含概览聚合数据）。"""
    result = await db.execute(
        select(Project)
        .where(
            Project.id == project_id,
            Project.user_id == current_user["id"],
            _not_deleted(),
        )
        .options(
            selectinload(Project.questions),
            selectinload(Project.datasets),
            selectinload(Project.reports),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException(ERR_PROJECT_NOT_FOUND)

    project.overview = await get_project_overview(project)
    return ResponseModel(data=project)


@router.patch(
    "/{project_id}",
    response_model=ResponseModel[ProjectResponse],
    summary="更新项目",
    description="更新项目名称"
)
async def update_project(
    project_id: UUID,
    request: ProjectUpdate,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """更新项目（当前仅支持重命名）。"""
    result = await db.execute(
        select(Project)
        .where(
            Project.id == project_id,
            Project.user_id == current_user["id"],
            _not_deleted(),
        )
        .options(
            selectinload(Project.questions),
            selectinload(Project.datasets),
            selectinload(Project.reports),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException(ERR_PROJECT_NOT_FOUND)

    old_name = project.name
    if request.name is not None:
        project.name = request.name

    await db.flush()
    await db.refresh(project)

    # 记录项目更新审计日志（仅当名称变更时）
    if request.name is not None and request.name != old_name:
        await AuditService.log_action(
            db=db,
            user_id=current_user["id"],
            action_type=ACTION_TYPES["PROJECT_UPDATE"],
            project_id=project_id,
            action_detail={"name_changed": {"from": old_name, "to": request.name}},
            ip_address=http_request.client.host if http_request.client else None,
            user_agent=http_request.headers.get("user-agent"),
        )

    project.overview = await get_project_overview(project)
    return ResponseModel(data=project)


@router.delete(
    "/{project_id}",
    status_code=204,
    summary="删除项目",
    description="删除项目（软删除）"
)
async def delete_project(
    project_id: UUID,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """删除项目（软删除，设置 deleted_at）。"""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"],
            _not_deleted(),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException(ERR_PROJECT_NOT_FOUND)

    now = datetime.now(timezone.utc)
    project.deleted_at = now
    project.updated_at = now

    # 记录项目删除审计日志
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["PROJECT_DELETE"],
        project_id=project_id,
        action_detail={"name": project.name, "deleted_at": now.isoformat()},
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent"),
    )
    await db.flush()
    return None
