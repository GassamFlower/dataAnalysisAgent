"""项目路由：项目 CRUD。"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.responses import ResponseModel
from app.core.exceptions import NotFoundException, ValidationException
from app.models.project import Project
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    ProjectListResponse,
)
from app.schemas.common import PaginatedData

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

    # 分页查询
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Project)
        .where(*base_filter)
        .order_by(Project.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    projects = result.scalars().all()

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
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """创建新的预演项目。"""
    project = Project(
        user_id=current_user["id"],
        name=request.name,
        status="draft"
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
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
    """获取项目详情。"""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"],
            _not_deleted(),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")
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
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """更新项目（当前仅支持重命名）。"""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"],
            _not_deleted(),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")

    if request.name is not None:
        project.name = request.name

    await db.flush()
    await db.refresh(project)
    return ResponseModel(data=project)


@router.delete(
    "/{project_id}",
    status_code=204,
    summary="删除项目",
    description="删除项目（软删除）"
)
async def delete_project(
    project_id: UUID,
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
        raise NotFoundException("项目不存在")

    now = datetime.now(timezone.utc)
    project.deleted_at = now
    project.updated_at = now
    await db.flush()
    return None
