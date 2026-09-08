"""统一管理后台 API（F-ADM-001 ~ F-ADM-005）——全部 require_admin。

立项文档：docs/管理后台-立项文档.md
覆盖：用户与项目运营、订单与支付、审计日志、看板聚合。
说明：管理接口统一使用 require_admin 依赖，收敛历史散落的门禁写法。
"""
import csv
import io
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Body, Depends, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin, require_module, require_super_admin
from app.core.exceptions import NotFoundException, ValidationException
from app.core.responses import success_response
from app.models.audit_logs import AuditLog
from app.models.admin_permission import AdminPermission
from app.models.message import Message, STATUS_CHOICES
from app.models.order import Order
from app.models.project import Project
from app.models.user import User
from app.models.analytics_event import AnalyticsEvent
from app.schemas.message import (
    MessageStatusUpdate,
    TAG_LABELS,
    DATA_SOURCE_LABELS,
    STATUS_LABELS,
)
from app.services.admin_service import (
    VALID_PLANS,
    ADMIN_MODULES,
    ADMIN_MODULE_LABELS,
    ALL_ADMIN_MODULES,
    is_granted_active,
    get_user_modules,
    get_user_project_counts,
    user_admin_dict,
)
from app.services import admin_config_service
from app.services.audit_service import AuditService
from app.services import payment_service

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


def _parse_bool_query(value: Optional[str], name: str = "disabled") -> Optional[bool]:
    """宽松解析 query 布尔参数：容忍空串/大小写/0|1/yes|no/on|off。

    返回 None 表示「不过滤」；无法识别时抛 400（而非 FastAPI 默认 422）。
    """
    if value is None:
        return None
    v = value.strip().lower()
    if v in ("", "none", "null", "undefined"):
        return None
    if v in ("1", "true", "yes", "on", "t", "y"):
        return True
    if v in ("0", "false", "no", "off", "f", "n"):
        return False
    raise ValidationException(f"{name} 需为 true/false/1/0（留空=不过滤），收到：{value!r}")


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


# 授权/套餐时限上限（天）
MAX_GRANT_DAYS = 3650


def _resolve_datetime_aware(value: datetime) -> datetime:
    """把可能 naive 的输入时间统一为 UTC aware。"""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def validate_expiry(days: Optional[int] = None, expires_at: Optional[datetime] = None, *, field="到期时间"):
    """把「天数」或「具体日期」解析为 UTC aware 到期时间，并做合法性校验。

    - days 与 expires_at 二选一，不能同时为空或同时给出。
    - days：必须是正整数的正常天数，且不超过 MAX_GRANT_DAYS（超出报错）。
    - expires_at：必须晚于当前时刻（过去/今天的日期直接报错）。

    返回 UTC aware 的 datetime，供后续写入 expires_at。
    """
    now = datetime.now(timezone.utc)
    both = days is not None and expires_at is not None
    neither = days is None and expires_at is None
    if both or neither:
        raise ValidationException(
            f"{field}：请提供 天数(days) 或 具体到期日期(expires_at) 两者之一（不能同时/都不提供）"
        )
    if expires_at is not None:
        aware = _resolve_datetime_aware(expires_at)
        if aware <= now:
            raise ValidationException(
                f"{field}必须晚于当前时间（不允许过去或今天的日期）"
            )
        return aware
    if days is not None:
        if days < 1:
            raise ValidationException(f"{field}天数必须为正整数")
        if days > MAX_GRANT_DAYS:
            raise ValidationException(f"{field}天数不能超过 {MAX_GRANT_DAYS} 天")
        return now + timedelta(days=days)


# ── 用户与项目运营（F-ADM-001）────────────────────────────────────────


@router.get("/users")
async def admin_users(
    keyword: str = Query("", description="按邮箱/昵称关键词搜索"),
    plan: Optional[str] = Query(None, description="按套餐筛选"),
    disabled: Optional[str] = Query(
        None, description="true/false/1/0 = 仅禁用/仅正常；留空 = 全部"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_module(ADMIN_MODULES.USERS)),
):
    """管理员：用户分页列表（含脱敏邮箱与项目数）。"""
    disabled_flag = _parse_bool_query(disabled)
    stmt = select(User).where(User.deleted_at.is_(None))
    kw = (keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        stmt = stmt.where((User.email.ilike(like)) | (User.nickname.ilike(like)))
    if plan:
        stmt = stmt.where(User.plan == plan)
    if disabled_flag is True:
        stmt = stmt.where(User.disabled_at.is_not(None))
    elif disabled_flag is False:
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


class _UserExportRequest(BaseModel):
    """可选筛选：与列表一致；留空则导出全部注册用户。"""
    keyword: Optional[str] = Field(None, max_length=100)
    plan: Optional[str] = Field(None)
    disabled: Optional[bool] = Field(None)


@router.post("/users/export", summary="导出全部用户 CSV")
async def admin_export_users(
    payload: Optional[_UserExportRequest] = Body(None),
    request: Request = None,  # noqa: B008 FastAPI 注入
    current: dict = Depends(require_module(ADMIN_MODULES.USERS)),
    db: AsyncSession = Depends(get_db),
):
    """导出（筛选后的）全部注册用户为 CSV，前端触发浏览器下载。

    覆盖“看到每一个注册用户”需求：不分页、一次拉全量，便于外部运营离线管理。
    """
    payload = payload or _UserExportRequest()
    stmt = select(User).where(User.deleted_at.is_(None))
    kw = (payload.keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        stmt = stmt.where((User.email.ilike(like)) | (User.nickname.ilike(like)))
    if payload.plan:
        stmt = stmt.where(User.plan == payload.plan)
    if payload.disabled is True:
        stmt = stmt.where(User.disabled_at.is_not(None))
    elif payload.disabled is False:
        stmt = stmt.where(User.disabled_at.is_(None))
    stmt = stmt.order_by(User.created_at.desc())

    res = await db.execute(stmt)
    users = res.scalars().all()
    counts = await get_user_project_counts(db, [str(u.id) for u in users])

    buf = io.StringIO()
    out = csv.writer(buf)
    out.writerow([
        "用户ID", "邮箱", "昵称", "套餐", "套餐到期", "项目数",
        "是否管理员", "邮箱已验证", "状态", "注册时间",
    ])
    for u in users:
        plan_exp = u.plan_expires_at.strftime("%Y-%m-%d %H:%M") if u.plan_expires_at else ""
        created = u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else ""
        out.writerow([
            str(u.id), u.email or "", u.nickname or "", u.plan, plan_exp,
            counts.get(str(u.id), 0),
            "是" if u.is_admin else "否",
            "是" if u.email_verified else "否",
            "已禁用" if u.disabled_at is not None else "正常",
            created,
        ])
    # 带 BOM，Excel 打开中文不乱码
    body = "\ufeff" + buf.getvalue()
    filename = "users-export.csv"
    await _audit(request, db, current["id"], "admin_export_users",
                 {"count": len(users), "plan": payload.plan, "disabled_only": payload.disabled is True})

    res = StreamingResponse(iter([body.encode("utf-8")]), media_type="text/csv; charset=utf-8")
    res.headers["Content-Disposition"] = f"attachment; filename={filename}"
    # 审计先于 commit，StreamingResponse 返回 STREAMING 时由框架读 body；
    # 这里确保写入审计后显式 commit，避免脏连接
    await db.commit()
    return res
async def user_detail(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_module(ADMIN_MODULES.USERS)),
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
    current: dict = Depends(require_module(ADMIN_MODULES.USERS)),
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
    # 到期时间：若提供必须晚于当前时刻（过去/今天报错）
    if req.expires_at is not None:
        expire_aware = _resolve_datetime_aware(req.expires_at)
        if expire_aware <= datetime.now(timezone.utc):
            raise ValidationException("到期时间必须晚于当前时间（不允许过去或今天的日期）")
        req.expires_at = expire_aware
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
    current: dict = Depends(require_module(ADMIN_MODULES.USERS)),
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
            # 线下开通订单无第三方流水号：人工校验结清，凭 "" 对账（区别于在线支付）
            "is_offline": o.provider_transaction_id is None and o.status == "paid",
        }
        for o, u in res.all()
    ]
    return success_response(data=_paged(items, total, page, page_size))


class _OfflineOrderCreateRequest(BaseModel):
    user_id: str = Field(..., description="目标用户 ID")
    plan_type: Literal["single", "subscription"] = Field(..., description="single 单次 / subscription 开通期")
    days: Optional[int] = Field(None, ge=1, description="开通天数（默认 single/subscription 均为 30 天）")
    expires_at: Optional[datetime] = Field(None, description="直接开到该具体到期日期（与 days 二选一，须晚于当前）")
    channel: str = Field("other", description="线下成交渠道：xianyu / wechat / alipay / cash / other")
    remark: Optional[str] = Field(None, max_length=500, description="对账备注（如咸鱼订单号）")
    amount: Optional[Decimal] = Field(None, description="实收金额（元，缺省按服务端定价）")


@router.post("/orders", summary="手动开通：创建线下已支付订单并激活套餐")
async def admin_create_offline_order(
    req: _OfflineOrderCreateRequest,
    request: Request,
    current: dict = Depends(require_module(ADMIN_MODULES.USERS)),
    db: AsyncSession = Depends(get_db),
):
    """线下成交后，管理后台为该用户开一笔「线下单」并同事务激活套餐。

    - 同事务：订单落库 + 用户套餐写入，成功后要么都有要么都没有。
    - 渠道 + 备注写入审计（action_detail），供对账；Order 表记录金额/类型/状态。
    - 不调用在线支付回调，provider_transaction_id 留空的已完成。
    """
    uid = _uuid(req.user_id) if req.user_id else None
    if not uid:
        raise NotFoundException("无效的用户 ID")
    user = await db.get(User, uid)
    if not user or user.deleted_at is not None:
        raise NotFoundException("用户不存在")

    order = await payment_service.create_offline_paid_order(
        db,
        user_id=uid,
        order_type=req.plan_type,  # type: ignore[arg-type]
        channel=req.channel or "other",
        remark=req.remark,
        amount=req.amount,
        days=req.days,
        expires_at=req.expires_at,
    )
    await _audit(
        request, db, current["id"], "admin_create_offline_order",
        {
            "target_user_id": str(uid),
            "order_id": str(order.id),
            "plan_type": req.plan_type,
            "amount": str(order.amount),
            "channel": req.channel or "other",
            "remark": req.remark,
            "days": req.days,
            "expires_at": req.expires_at.isoformat() if req.expires_at else None,
            "new_expires_at": order.expires_at.isoformat() if order.expires_at else None,
        },
    )
    await db.commit()
    await db.refresh(order)
    await db.refresh(user)
    return success_response(data={
        **user_admin_dict(user),
        "order": {
            "id": str(order.id),
            "type": order.type,
            "amount": str(order.amount),
            "status": order.status,
            "expires_at": order.expires_at.isoformat() if order.expires_at else None,
        },
    })


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


class _OrderRefundRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500, description="退款原因 / 对账备注")


@router.patch("/orders/{order_id}/refund", summary="订单退标记")
async def admin_refund_order(
    order_id: str,
    req: _OrderRefundRequest,
    request: Request,
    current: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员：将「已支付」订单标记为已退款（仅 paid → refunded），写审计留痕。

    仅作为运营对账标记，不实际退款。禁止对非 paid 订单操作。
    """
    oid = _uuid(order_id)
    if not oid:
        raise NotFoundException("无效的订单 ID")
    order = await db.get(Order, oid)
    if not order or order.deleted_at is not None:
        raise NotFoundException("订单不存在")
    if order.status != "paid":
        raise ValidationException(f"仅「已支付」订单可退款，当前状态为 {order.status}")

    before = order.status
    order.status = "refunded"
    await _audit(
        request, db, current["id"], "admin_refund_order",
        {
            "order_id": str(order.id),
            "old_status": before,
            "new_status": "refunded",
            "amount": str(order.amount),
            "reason": req.reason,
        },
    )
    await db.commit()
    await db.refresh(order)
    return success_response(data={
        "id": str(order.id), "status": order.status, "amount": str(order.amount),
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


# ── 运营看板增强（F-ADM-004 增强：套餐分布 / 活跃项目 / 留言待处理）─────


@router.get("/dashboard/overview")
async def admin_dashboard_overview(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """管理员：运营概览补充维度（用户套餐分布 / 项目规模 / 留言待办）。"""
    # 用户套餐分布（仅计算未删除用户）
    plan_rows = await db.execute(
        select(User.plan, func.count(User.id))
        .where(User.deleted_at.is_(None))
        .group_by(User.plan)
    )
    plan_dist = {plan: cnt for plan, cnt in plan_rows.all()}

    # 总用户数
    total_users = (
        await db.execute(
            select(func.count(User.id)).where(User.deleted_at.is_(None))
        )
    ).scalar_one()

    # 项目规模（未删除项目，按模式分）
    mode_rows = await db.execute(
        select(Project.mode, func.count(Project.id))
        .where(Project.deleted_at.is_(None))
        .group_by(Project.mode)
    )
    projects_by_mode = {m: c for m, c in mode_rows.all()}
    total_projects = sum(projects_by_mode.values())

    # 近 7 天活跃用户数（7 天内有过任意埋点事件的去重用户）
    from datetime import timedelta
    active_since = datetime.now(timezone.utc) - timedelta(days=7)
    active_users = (
        await db.execute(
            select(func.count(func.distinct(AnalyticsEvent.user_id)))
            .where(AnalyticsEvent.created_at >= active_since)
        )
    ).scalar_one()

    # 留言待处理数（pending）
    pending_messages = (
        await db.execute(
            select(func.count(Message.id))
            .where(Message.deleted_at.is_(None), Message.status == "pending")
        )
    ).scalar_one()

    return success_response(data={
        "total_users": total_users,
        "plan_distribution": {
            "free": plan_dist.get("free", 0),
            "single": plan_dist.get("single", 0),
            "subscription": plan_dist.get("subscription", 0),
        },
        "projects_by_mode": {
            "real": projects_by_mode.get("real", 0),
            "simulation": projects_by_mode.get("simulation", 0),
        },
        "total_projects": total_projects,
        "active_users_7d": active_users,
        "pending_messages": pending_messages,
    })


# ── 配置与配额管理（F-ADM-003 增强：运行时配额配置）────────────────────


class _QuotaLimitUpdateRequest(BaseModel):
    action: str = Field(..., description="动作类型（simulation/export/analysis/data_import/ai_interpret）")
    value: int = Field(..., ge=0, description="每周配额上限（>=0）", le=100000)


@router.get("/configs/quota-limits")
async def admin_get_quota_limits(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """管理员：读取当前免费配额各动作上限（含来源：default=默认值 / override=后台覆盖）。"""
    defaults = admin_config_service.DEFAULT_QUOTA_LIMITS
    effective = await admin_config_service.get_quota_limits(db)
    items = [
        {
            "action": action,
            "label": admin_config_service.QUOTA_ACTION_LABELS.get(action, action),
            "value": effective.get(action, default),
            "default_value": default,
            "source": "override" if effective.get(action) != default else "default",
        }
        for action, default in defaults.items()
    ]
    return success_response(data={"items": items, "count": len(items)})


@router.put("/configs/quota-limits/{action}")
async def update_quota_limit(
    action: str,
    req: _QuotaLimitUpdateRequest,
    request: Request,
    current: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员：运行时调整单个动作的免费配额上限（写 app_configs + 审计）。"""
    if action not in admin_config_service.DEFAULT_QUOTA_LIMITS:
        raise NotFoundException("不支持的配额动作")
    ok = await admin_config_service.upsert_quota_limits(
        db, action, req.value, updated_by=str(current["id"])
    )
    if not ok:
        raise ValidationException("配额值非法，必须为非负整数")
    await _audit(
        request, db, current["id"], "admin_update_quota_limit",
        {"action": action, "value": req.value},
    )
    await db.commit()
    effective = await admin_config_service.get_quota_limits(db)
    return success_response(data={
        "action": action,
        "value": effective.get(action, admin_config_service.DEFAULT_QUOTA_LIMITS.get(action)),
        "source": "override",
    })


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


class _MessageBatchStatusRequest(BaseModel):
    """批量更新留言状态（同状态 + 可选统一备注）。"""
    message_ids: list[str] = Field(..., min_length=1, max_length=200)
    status: Literal["pending", "processing", "done"]
    handle_remark: Optional[str] = Field(None, max_length=500)


@router.patch("/messages/batch-status", summary="批量更新留言状态")
async def admin_batch_update_message_status(
    req: _MessageBatchStatusRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: dict = Depends(require_admin),
):
    """管理员：一次把多条留言标记为同一状态（写逐条审计）。"""
    if req.status not in STATUS_CHOICES:
        raise ValidationException(f"status 必须是 {' / '.join(STATUS_CHOICES)} 之一")

    ids = []
    for raw in req.message_ids:
        oid = _uuid(raw)
        if oid:
            ids.append(oid)
    if not ids:
        raise ValidationException("没有有效的留言 ID")

    res = await db.execute(
        select(Message).where(
            Message.id.in_(ids),
            Message.deleted_at.is_(None),
        )
    )
    msgs = res.scalars().all()
    if not msgs:
        raise NotFoundException("没有找到匹配的留言")

    now = datetime.now(timezone.utc)
    updated: list[str] = []
    for m in msgs:
        m.status = req.status
        if req.handle_remark is not None:
            m.handle_remark = req.handle_remark
        m.handled_by = current_admin["id"]
        m.handled_at = now
        updated.append(str(m.id))
        await _audit(
            request, db, current_admin["id"], "admin_mark_message",
            {
                "message_id": str(m.id),
                "status": req.status,
                "remark": req.handle_remark,
                "batch": True,
            },
        )
    await db.commit()
    return success_response(data={"updated": len(updated), "message_ids": updated})


# ── 管理员授权管理（F-ADM-006：委派管理员 + 授权有效期）────────────────


def _perm_dict(p: AdminPermission) -> dict:
    return {
        "user_id": str(p.user_id),
        "module": p.module,
        "module_label": ADMIN_MODULE_LABELS.get(p.module, p.module),
        "expires_at": p.expires_at.isoformat() if p.expires_at else None,
        "permanent": p.expires_at is None,
        "active": is_granted_active(p),
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _admin_role_dict(user: User, modules: list[dict]) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "nickname": user.nickname,
        "is_admin": user.is_admin,
        "is_super_admin": user.is_super_admin,
        "disabled": user.disabled_at is not None,
        "modules": modules,
    }


@router.get("/modules", summary="后台可授予模块清单")
async def admin_modules_catalog(
    _: dict = Depends(require_admin),
):
    """返回所有可授权后台模块及其标签（供前端勾选）。"""
    items = [
        {"module": m, "label": ADMIN_MODULE_LABELS.get(m, m)}
        for m in sorted(ALL_ADMIN_MODULES)
    ]
    return success_response(data={"items": items, "count": len(items)})


@router.get("/permissions", summary="列出所有管理员（超管+子管理员）及其授权")
async def admin_list_permissions(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    """超管专用：列出全部管理员账号及其已授予模块与到期时间。"""
    res = await db.execute(
        select(User)
        .where(User.deleted_at.is_(None), User.is_admin.is_(True))
        .order_by(User.created_at.asc())
    )
    admins = res.scalars().all()
    # 一次取回所有授权，按 user 归组
    perm_res = await db.execute(select(AdminPermission))
    by_user: dict = {}
    for p in perm_res.scalars().all():
        by_user.setdefault(str(p.user_id), []).append(_perm_dict(p))
    items = [_admin_role_dict(u, by_user.get(str(u.id), [])) for u in admins]
    return success_response(data={"items": items, "count": len(items)})


class _GrantPermRequest(BaseModel):
    user_id: str = Field(..., description="被授权账号 ID")
    module: str = Field(..., description="后台模块标识")
    days: Optional[int] = Field(None, ge=1, description="授权天数（与 expires_at 二选一）")
    expires_at: Optional[datetime] = Field(None, description="授权具体到期日期（与 days 二选一，须晚于当前）")


@router.post("/permissions", summary="授予子管理员某后台模块（可带期限）")
async def admin_grant_permission(
    req: _GrantPermRequest,
    request: Request,
    current: dict = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """超管：为某账号授予指定后台模块，使其成为子管理员并可访问该模块。

    - 被授权账号会同时被置为 is_admin=True（子管理员）。
    - module 必须属于可授予模块（ALL_ADMIN_MODULES）。
    - days / expires_at 二选一：设定该模块授权的有效期（须为未来/合法天数）。
    """
    if req.module not in ALL_ADMIN_MODULES:
        raise ValidationException(
            f"module 必须是 {' / '.join(sorted(ALL_ADMIN_MODULES))} 之一"
        )
    uid = _uuid(req.user_id)
    if not uid:
        raise NotFoundException("无效的用户 ID")
    target = await db.get(User, uid)
    if not target or target.deleted_at is not None:
        raise NotFoundException("用户不存在")
    if str(target.id) == str(current["id"]):
        raise ValidationException("不能给当前超管自己再授权（超管已拥有全部模块）")
    if target.is_super_admin:
        raise ValidationException("超管已拥有全部后台模块，无需再授权")

    expires_at = validate_expiry(req.days, req.expires_at, field="模块授权期限")

    # 幂等：若已有该模块授权，则更新其期限
    existing = (
        await db.execute(
            select(AdminPermission).where(
                AdminPermission.user_id == target.id,
                AdminPermission.module == req.module,
            )
        )
    ).scalar_one_or_none()
    target.is_admin = True
    if existing:
        existing.expires_at = expires_at
        perm = existing
    else:
        perm = AdminPermission(
            user_id=target.id,
            module=req.module,
            created_by=current["id"],
            expires_at=expires_at,
        )
        db.add(perm)

    await _audit(
        request, db, current["id"], "admin_grant_permission",
        {
            "target_user_id": str(target.id),
            "module": req.module,
            "expires_at": expires_at.isoformat() if expires_at else None,
        },
    )
    await db.commit()
    await db.refresh(perm) if hasattr(perm, "expires_at") else None
    return success_response(data={**_admin_role_dict(target, [_perm_dict(perm)])})


@router.delete("/permissions/user/{user_id}", summary="移除账号的管理员身份")
async def admin_remove_admin(
    user_id: str,
    request: Request,
    current: dict = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """超管：彻底移除某账号的管理员身份（撤销全部模块授权 + is_admin=False）。

    不允许对超管账号执行。
    """
    uid = _uuid(user_id)
    if not uid:
        raise NotFoundException("无效的用户 ID")
    target = await db.get(User, uid)
    if not target or target.deleted_at is not None:
        raise NotFoundException("用户不存在")
    if target.is_super_admin:
        raise ValidationException("超管账号不能通过此方式移除，请谨慎操作")

    # 删除该账号所有授权并解除管理员身份
    perms = (
        await db.execute(
            select(AdminPermission).where(AdminPermission.user_id == target.id)
        )
    ).scalars().all()
    for p in perms:
        await db.delete(p)
    target.is_admin = False

    await _audit(
        request, db, current["id"], "admin_remove_admin",
        {
            "target_user_id": str(target.id),
            "removed_modules": [p.module for p in perms],
        },
    )
    await db.commit()
    return success_response(data={"removed": True, "user_id": user_id})


class _UpdatePermRequest(BaseModel):
    days: Optional[int] = Field(None, ge=1)
    expires_at: Optional[datetime] = Field(None)


@router.patch("/permissions/{user_id}/{module}", summary="更新子管理员某模块授权期限")
async def admin_update_permission(
    user_id: str,
    module: str,
    req: _UpdatePermRequest,
    request: Request,
    current: dict = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """超管：调整某子管理员某模块的到期时间（days：**重新**从当前时间累加）。"""
    if module not in ALL_ADMIN_MODULES:
        raise ValidationException("未知的后台模块")
    uid = _uuid(user_id)
    if not uid:
        raise NotFoundException("无效的用户 ID")
    perm = (
        await db.execute(
            select(AdminPermission).where(
                AdminPermission.user_id == uid,
                AdminPermission.module == module,
            )
        )
    ).scalar_one_or_none()
    if not perm:
        raise NotFoundException("该账号尚未被授予此模块")
    new_expiry = validate_expiry(req.days, req.expires_at, field="模块授权期限")
    old_expiry = perm.expires_at
    perm.expires_at = new_expiry
    await _audit(
        request, db, current["id"], "admin_update_permission",
        {
            "target_user_id": user_id,
            "module": module,
            "old_expires_at": old_expiry.isoformat() if old_expiry else None,
            "new_expires_at": new_expiry.isoformat() if new_expiry else None,
        },
    )
    await db.commit()
    await db.refresh(perm)
    return success_response(data=_perm_dict(perm))


@router.delete("/permissions/{user_id}/{module}", summary="撤销某账号的某后台模块")
async def admin_revoke_permission(
    user_id: str,
    module: str,
    request: Request,
    current: dict = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """超管：撤销某账号的指定模块授权。

    若撤销后该账号不再拥有任何被授权模块（且非超管），则将 is_admin 置回 False，
    使其退回普通用户，无法再进入管理后台。
    """
    uid = _uuid(user_id)
    if not uid:
        raise NotFoundException("无效的用户 ID")
    perm = (
        await db.execute(
            select(AdminPermission).where(
                AdminPermission.user_id == uid,
                AdminPermission.module == module,
            )
        )
    ).scalar_one_or_none()
    if not perm:
        raise NotFoundException("该账号尚未被授予该模块")

    target = await db.get(User, uid)
    await db.delete(perm)

    if target and not target.is_super_admin:
        remain = (
            await db.execute(
                select(AdminPermission).where(AdminPermission.user_id == target.id)
            )
        ).scalars().all()
        if not remain:
            target.is_admin = False

    await _audit(
        request, db, current["id"], "admin_revoke_permission",
        {"target_user_id": user_id, "module": module},
    )
    await db.commit()
    return success_response(data={"revoked": True, "user_id": user_id, "module": module})