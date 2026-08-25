"""留言（售后）路由。

覆盖 Task 2.1：
- 建：POST /messages
- 查：GET /messages（本人列表，可筛选 tag/status/data_source）、GET /messages/{id}
- 删：DELETE /messages/{id}（本人软删）
- 处理：PATCH /messages/{id}/status（本人关闭自己的留言为 done；
        管理员可切换任意状态 + 写备注，并写入审计日志衔接留痕）
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.responses import ResponseModel
from app.core.exceptions import NotFoundException, ValidationException, ForbiddenException
from app.models.message import Message, STATUS_CHOICES
from app.models.project import Project
from app.schemas.common import PaginatedData
from app.schemas.message import (
    TAG_CHOICES,
    DATA_SOURCE_CHOICES,
    TAG_LABELS,
    DATA_SOURCE_LABELS,
    STATUS_LABELS,
    MessageCreate,
    MessageStatusUpdate,
    MessageResponse,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/messages", tags=["留言"])


def _serialize(m: Message) -> MessageResponse:
    return MessageResponse(
        id=m.id,
        user_id=m.user_id,
        project_id=m.project_id,
        tag=m.tag,
        tag_label=TAG_LABELS.get(m.tag, m.tag),
        data_source=m.data_source,
        data_source_label=DATA_SOURCE_LABELS.get(m.data_source) if m.data_source else None,
        entry_point=m.entry_point,
        contact=m.contact,
        content=m.content,
        status=m.status,
        status_label=STATUS_LABELS.get(m.status, m.status),
        handled_by=m.handled_by,
        handled_at=m.handled_at,
        handle_remark=m.handle_remark,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


async def _get_own_message(db: AsyncSession, user_id: uuid.UUID, message_id: str) -> Message:
    try:
        mid = uuid.UUID(str(message_id))
    except ValueError:
        raise NotFoundException("留言不存在")
    m = await db.get(Message, mid)
    if (
        not m
        or m.user_id != user_id
        or m.deleted_at is not None
    ):
        raise NotFoundException("留言不存在")
    return m


@router.post(
    "",
    response_model=ResponseModel[MessageResponse],
    summary="提交留言",
    description="新增一条售后留言，自动带当前用户 ID，可关联项目与数据源。",
)
async def create_message(
    req: MessageCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if req.tag not in TAG_CHOICES:
        raise ValidationException(f"tag 必须是 {' / '.join(TAG_CHOICES)} 之一")
    if req.data_source is not None and req.data_source not in DATA_SOURCE_CHOICES:
        raise ValidationException(f"data_source 必须是 {DATA_SOURCE_CHOICES} 之一")

    # 关联项目校验：必须属于当前用户，否则拒绝挂靠
    if req.project_id is not None:
        proj = await db.get(Project, req.project_id)
        if not proj or proj.deleted_at is not None or proj.user_id != current_user["id"]:
            raise ValidationException("关联项目不存在或不属于当前用户")

    m = Message(
        user_id=current_user["id"],
        project_id=req.project_id,
        tag=req.tag,
        data_source=req.data_source,
        entry_point=req.entry_point,
        contact=req.contact,
        content=req.content,
        status="pending",
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return ResponseModel(data=_serialize(m))


@router.get(
    "",
    response_model=ResponseModel[PaginatedData[MessageResponse]],
    summary="我的留言列表",
    description="当前用户留言分页列表，可按 tag / status / data_source 筛选。",
)
async def list_messages(
    tag: str = Query("", description="按分类筛选"),
    status: str = Query("", description="按状态筛选"),
    data_source: str = Query("", description="按数据源筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    base_filter = [
        Message.user_id == current_user["id"],
        Message.deleted_at.is_(None),
    ]
    if tag:
        base_filter.append(Message.tag == tag)
    if status:
        base_filter.append(Message.status == status)
    if data_source:
        base_filter.append(Message.data_source == data_source)

    total = (
        await db.execute(select(func.count()).select_from(
            select(Message.id).where(*base_filter).subquery()
        ))
    ).scalar_one()

    res = await db.execute(
        select(Message)
        .where(*base_filter)
        .order_by(Message.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [_serialize(m) for m in res.scalars().all()]
    return ResponseModel(data=PaginatedData(
        items=items, total=total, page=page, page_size=page_size
    ))


@router.get(
    "/{message_id}",
    response_model=ResponseModel[MessageResponse],
    summary="留言详情",
)
async def get_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    m = await _get_own_message(db, current_user["id"], message_id)
    return ResponseModel(data=_serialize(m))


@router.patch(
    "/{message_id}/status",
    response_model=ResponseModel[MessageResponse],
    summary="标记留言处理状态",
    description="本人可将自己的留言标记为已处理(done)；管理员可切换任意状态并写备注（写审计日志）。",
)
async def update_message_status(
    message_id: str,
    req: MessageStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if req.status not in STATUS_CHOICES:
        raise ValidationException(f"status 必须是 {' / '.join(STATUS_CHOICES)} 之一")
    m = await _get_own_message(db, current_user["id"], message_id)

    is_admin = bool(current_user.get("is_admin"))
    # 用户本人：仅允许关闭自己的留言为 done；管理员：任意状态 + 备注
    if not is_admin and req.status != "done":
        raise ForbiddenException("只能将留言标记为已处理")

    m.status = req.status
    if req.handle_remark is not None:
        m.handle_remark = req.handle_remark

    if is_admin:
        m.handled_by = current_user["id"]
        m.handled_at = datetime.now(timezone.utc)
        await AuditService.log_action(
            db=db,
            user_id=current_user["id"],
            action_type="admin_mark_message",
            project_id=m.project_id,
            action_detail={
                "message_id": str(m.id),
                "status": req.status,
                "remark": req.handle_remark,
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    # 非管理员关闭自己的留言也记录处理时间（不写审计）
    elif req.status == "done" and m.handled_at is None:
        m.handled_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(m)
    return ResponseModel(data=_serialize(m))


@router.delete(
    "/{message_id}",
    response_model=ResponseModel[dict],
    summary="删除留言",
    description="删除自己的一条留言（软删除）。",
)
async def delete_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    m = await _get_own_message(db, current_user["id"], message_id)
    m.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return ResponseModel(data={"id": str(m.id), "deleted": True})