"""统一管理后台 API（F-ADM-001 ~ F-ADM-005）——全部 require_admin。

立项文档：docs/管理后台-立项文档.md
覆盖：用户与项目运营、订单与支付、审计日志、看板聚合。
说明：管理接口统一使用 require_admin 依赖，收敛历史散落的门禁写法。
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.core.exceptions import NotFoundException, ValidationException
from app.core.responses import success_response
from app.models.audit_logs import AuditLog
from app.models.message import Message, STATUS_CHOICES
from app.models.order import Order
from app.models.project import Project
from app.models.user import User
from app.schemas.message import (
    MessageStatusUpdate,
    TAG_LABELS,
    DATA_SOURCE_LABELS,
    STATUS_LABELS,
)
from app.services.admin_service import VALID_PLANS, get_user_project_counts, user_admin_dict
from app.services.audit_service import AuditService

router = APIRouter(prefix="/admin", tags=["管理后台"])


# ── Helpers ──────────────────────────────────────────────────────────


def _uuid(v: Optional[str]):
    if not v:
        return None
    try:
        return uuid.UUID(str(v))
    except ValueError:
        return None


def _paged(items, total, page, page_size):
    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def _audit(request: Request, db: AsyncSession, admin_id, action_type: str, detail: dict):
    """记录管理员操作审计日志（不 commit，调用方已 commit）。"""
    await AuditService.log_action(
        db=db,
        user_id=admin_id,
        action_type=action_type,
        action_detail=detail,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


# ── 用户与项目运营（F-ADM-001）────────────────────────────────────────


@router.get("/users")
async def admin_users(
    keyword: str = Query("", description="按邮箱/昵称关键词搜索"),
    plan: Optional[str] = Query(None, description="按套餐筛选"),
    disabled: Optional[bool] = Query(None, description="true=仅禁用, false=仅正常"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """管理员：用户分页列表（含脱敏邮箱与项目数）。"""
    stmt = select(User).where(User.deleted_at.is_(None))
    kw = (keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        stmt = stmt.where((User.email.ilike(like)) | (User.nickname.ilike(like)))
    if plan:
        stmt = stmt.where(User.plan == plan)
    if disabled is True:
        stmt = stmt.where(User.disabled_at.is_not(None))
    elif disabled is False:
        stmt = stmt.where(User.disabled_at.is_(None))

    total = (await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar_one()
    res = await db.execute(
        stmt.order_by(User.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    users = res.scalars().all()
    counts = await get_user_project_counts(db, [str(u.id) for u in users])
    items = [
        {**user_admin_dict(u), "project_count": counts.get(str(u.id), 0)}
        for u in users
    ]
    return success_response(data=_paged(items, total, page, page_size))


@router.get("/users/{user_id}")
async def user_detail(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """用户详情 + 项目列表。"""
    uid = _uuid(user_id)
    if not uid:
        raise NotFoundException("无效的用户 ID")
    user = await db.get(User, uid)
    if not user or user.deleted_at is not None:
        raise NotFoundException("用户不存在")
    res = await db.execute(
        select(Project)
        .where(Project.user_id == uid, Project.deleted_at.is_(None))
        .order_by(Project.created_at.desc()).limit(50)
    )
    projects = [
        {
            "id": str(p.id), "name": p.name, "mode": p.mode, "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in res.scalars().all()
    ]
    return success_response(data={**user_admin_dict(user), "projects": projects})


class _PlanChangeRequest(BaseModel):
    plan: str
    expires_at: Optional[datetime] = None


@router.patch("/users/{user_id}/plan", summary="调整用户套餐")
async def user_change_plan(
    user_id: str,
    req: _PlanChangeRequest,
    request: Request,
    current: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """调整用户套餐（管理员；禁止改自己）。"""
    uid = _uuid(user_id)
    if not uid:
        raise NotFoundException("无效的用户 ID")
    if str(uid) == str(current["id"]):
        raise ValidationException("不能修改自己的套餐")
    if req.plan not in VALID_PLANS:
        raise ValidationException("套餐必须是 free / single / subscription")
    user = await db.get(User, uid)
    if not user or user.deleted_at is not None:
        raise NotFoundException("用户不存在")

    old = user.plan
    user.plan = req.plan
    user.plan_expires_at = req.expires_at
    await _audit(request, db, current["id"], "admin_change_plan",
                 {"target_user_id": user_id, "old_plan": old, "new_plan": req.plan})
    await db.commit()
    return success_response(data=user_admin_dict(user))


class _DisableRequest(BaseModel):
    disabled: bool


@router.patch("/users/{user_id}/disabled", summary="禁用/启用用户")
async def user_set_disabled(
    user_id: str,
    req: _DisableRequest,
    request: Request,
    current: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """禁用/启用账号（禁止禁用自己或其他管理员）。"""
    uid = _uuid(user_id)
    if not uid:
        raise NotFoundException("无效的用户 ID")
    if str(uid) == str(current["id"]):
        raise NotFoundException("不能禁用自己")
    user = await db.get(User, uid)
    if not user or user.deleted_at is not None:
        raise NotFoundException("用户不存在")
    if user.is_admin:
        raise NotFoundException("不能禁用管理员账号")

    before = user.disabled_at is not None
    user.disabled_at = datetime.now(timezone.utc) if req.disabled else None
    await _audit(request, db, current["id"], "admin_toggle_disabled",
                 {"target_user_id": user_id, "disabled": req.disabled, "was_disabled": before})
    await db.commit()
    return success_response(data=user_admin_dict(user))


# ── 订单与支付管理（F-ADM-002）────────────────────────────────────────


@router.get("/orders")
async def admin_orders(
    status: Optional[str] = Query(None, description="按订单状态筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """订单分页列表（全局）。"""
    stmt = (
        select(Order, User)
        .join(User, Order.user_id == User.id)
        .where(Order.deleted_at.is_(None))
    )
    if status:
        stmt = stmt.where(Order.status == status)
    total = (await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar_one()
    res = await db.execute(
        stmt.order_by(Order.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    items = [
        {
            "id": str(o.id), "type": o.type, "amount": str(o.amount),
            "status": o.status, "paid_at": o.paid_at.isoformat() if o.paid_at else None,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "expires_at": o.expires_at.isoformat() if o.expires_at else None,
            "user_id": str(o.user_id), "user_email": u.email if u else None,
        }
        for o, u in res.all()
    ]
    return success_response(data=_paged(items, total, page, page_size))


@router.get("/orders/{order_id}")
async def order_detail(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """订单详情。"""
    oid = _uuid(order_id)
    if not oid:
        raise NotFoundException("无效的订单 ID")
    order = await db.get(Order, oid)
    if not order or order.deleted_at is not None:
        raise NotFoundException("订单不存在")
    return success_response(data={
        "id": str(order.id), "type": order.type, "amount": str(order.amount),
        "status": order.status, "provider_transaction_id": order.provider_transaction_id,
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "expires_at": order.expires_at.isoformat() if order.expires_at else None,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    })


# ── 审计日志（F-ADM-005）─────────────────────────────────────────────


@router.get("/audit-logs")
async def admin_audit_logs(
    action_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """审计日志分页列表。"""
    stmt = select(AuditLog)
    if action_type:
        stmt = stmt.where(AuditLog.action_type == action_type)
    uid = _uuid(user_id) if user_id else None
    if uid:
        stmt = stmt.where(AuditLog.user_id == uid)
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    res = await db.execute(
        stmt.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    items = [
        {
            "id": str(a.id), "user_id": str(a.user_id),
            "project_id": str(a.project_id) if a.project_id else None,
            "action_type": a.action_type, "action_detail": a.action_detail,
            "ip_address": a.ip_address,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in res.scalars().all()
    ]
    return success_response(data=_paged(items, total, page, page_size))


# ── 留言管理（Task 2.4）──────────────────────────────────────────────


def _msg_serialize(m: Message, user_email: str = "", user_nickname: str = "") -> dict:
    return {
        "id": str(m.id),
        "user_id": str(m.user_id),
        "user_email": user_email,
        "user_nickname": user_nickname,
        "project_id": str(m.project_id) if m.project_id else None,
        "tag": m.tag,
        "tag_label": TAG_LABELS.get(m.tag, m.tag),
        "data_source": m.data_source,
        "data_source_label": DATA_SOURCE_LABELS.get(m.data_source) if m.data_source else None,
        "entry_point": m.entry_point,
        "contact": m.contact,
        "content": m.content,
        "status": m.status,
        "status_label": STATUS_LABELS.get(m.status, m.status),
        "handled_by": str(m.handled_by) if m.handled_by else None,
        "handled_at": m.handled_at.isoformat() if m.handled_at else None,
        "handle_remark": m.handle_remark,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


@router.get("/messages")
async def admin_messages(
    tag: str = Query("", description="按分类筛选（presale/rescue/service/incident/feedback）"),
    status: str = Query("", description="按状态筛选（pending/processing/done）"),
    data_source: str = Query("", description="按数据源筛选"),
    keyword: str = Query("", description="按内容/联系方式/用户邮箱关键词搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """管理员：全量留言分页列表（含用户联系方式，便于一键复制跟进）。"""
    stmt = (
        select(Message, User.email, User.nickname)
        .join(User, User.id == Message.user_id)
        .where(Message.deleted_at.is_(None))
    )
    if tag:
        stmt = stmt.where(Message.tag == tag)
    if status:
        stmt = stmt.where(Message.status == status)
    if data_source:
        stmt = stmt.where(Message.data_source == data_source)
    kw = (keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        stmt = stmt.where(
            (Message.content.ilike(like))
            | (Message.contact.ilike(like))
            | (User.email.ilike(like))
        )

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    res = await db.execute(
        stmt.order_by(Message.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [
        _msg_serialize(m, user_email or "", user_nickname or "")
        for m, user_email, user_nickname in res.all()
    ]
    return success_response(data=_paged(items, total, page, page_size))


@router.patch("/messages/{message_id}/status")
async def admin_update_message_status(
    message_id: str,
    req: MessageStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: dict = Depends(require_admin),
):
    """管理员：切换任意留言状态并写备注（写审计日志留痕）。"""
    if req.status not in STATUS_CHOICES:
        raise ValidationException(f"status 必须是 {' / '.join(STATUS_CHOICES)} 之一")
    oid = _uuid(message_id)
    if not oid or oid is None:
        raise NotFoundException("留言不存在")
    m = await db.get(Message, oid)
    if not m or m.deleted_at is not None:
        raise NotFoundException("留言不存在")

    m.status = req.status
    if req.handle_remark is not None:
        m.handle_remark = req.handle_remark
    m.handled_by = current_admin["id"]
    m.handled_at = datetime.now(timezone.utc)
    await _audit(
        request, db, current_admin["id"], "admin_mark_message",
        {
            "message_id": str(m.id),
            "status": req.status,
            "remark": req.handle_remark,
        },
    )
    await db.commit()
    await db.refresh(m)
    return success_response(data=_msg_serialize(m))