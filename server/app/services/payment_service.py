"""支付与订阅业务服务。"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, NotFoundException, ValidationException
from app.models.order import Order
from app.models.project import Project
from app.models.user import User
from app.schemas.payment import OrderCreateRequest, OrderNotifyRequest, OrderType


# 套餐定价（单位：元）
PLAN_PRICING: dict[OrderType, Decimal] = {
    "single": Decimal("9.90"),
    "subscription": Decimal("19.90"),
}

# 套餐有效期（天）
PLAN_DURATION_DAYS: dict[OrderType, int] = {
    "single": 30,
    "subscription": 30,
}

# 套餐能力描述
PLAN_FEATURES: dict[str, list[str]] = {
    "free": [
        "题目上传解析",
        "题型/维度/反向题识别",
        "维度归属编辑",
    ],
    "single": [
        "全部免费能力",
        "单次数据预演",
        "标准统计报告",
        "R4 诊断",
        "Word/Excel 导出",
    ],
    "subscription": [
        "全部单次能力",
        "30 天内不限次预演",
        "30 天内不限次报告导出",
    ],
}


def get_plan_amount(plan_type: OrderType) -> Decimal:
    """获取套餐金额（服务端决定，禁止前端传入）。"""
    amount = PLAN_PRICING.get(plan_type)
    if amount is None:
        raise ValidationException(f"不支持的套餐类型: {plan_type}")
    return amount


def get_plan_duration_days(plan_type: OrderType) -> int:
    """获取套餐有效期天数。"""
    days = PLAN_DURATION_DAYS.get(plan_type)
    if days is None:
        raise ValidationException(f"不支持的套餐类型: {plan_type}")
    return days


def is_plan_active(user: User) -> bool:
    """判断用户当前套餐是否有效。"""
    if user.plan == "free":
        return False
    if user.plan_expires_at and user.plan_expires_at < datetime.now(timezone.utc):
        return False
    return True


def get_subscription_status(user: User) -> dict:
    """构造当前用户套餐状态字典。"""
    active = is_plan_active(user)
    return {
        "plan": user.plan,
        "expires_at": user.plan_expires_at,
        "is_active": active,
        "features": PLAN_FEATURES.get(user.plan, PLAN_FEATURES["free"]),
    }


async def create_order(
    db: AsyncSession,
    user_id: uuid.UUID,
    request: OrderCreateRequest,
) -> Order:
    """创建待支付订单。"""
    amount = get_plan_amount(request.plan_type)
    duration_days = get_plan_duration_days(request.plan_type)

    # 校验 project_id 归属（若传入）
    project: Optional[Project] = None
    if request.project_id:
        result = await db.execute(
            select(Project).where(
                Project.id == request.project_id,
                Project.user_id == user_id,
                Project.deleted_at.is_(None),
            )
        )
        project = result.scalar_one_or_none()
        if not project:
            raise NotFoundException("项目不存在")

    order = Order(
        user_id=user_id,
        project_id=request.project_id,
        type=request.plan_type,
        amount=amount,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=duration_days),
    )
    db.add(order)
    await db.flush()
    return order


async def list_orders(
    db: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[Order], int]:
    """查询用户订单列表（带分页）。"""
    stmt = (
        select(Order)
        .where(Order.user_id == user_id, Order.deleted_at.is_(None))
        .order_by(Order.created_at.desc())
    )

    count_stmt = select(Order).where(
        Order.user_id == user_id, Order.deleted_at.is_(None)
    )
    total_result = await db.execute(count_stmt)
    total = len(total_result.scalars().all())

    result = await db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
    orders = list(result.scalars().all())
    return orders, total


async def get_order_detail(
    db: AsyncSession,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
) -> Order:
    """查询订单详情（仅允许本人查看）。"""
    result = await db.execute(
        select(Order).where(
            Order.id == order_id,
            Order.user_id == user_id,
            Order.deleted_at.is_(None),
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundException("订单不存在")
    return order


async def process_payment_notification(
    db: AsyncSession,
    order_id: uuid.UUID,
    request: OrderNotifyRequest,
) -> Order:
    """处理支付回调（幂等、事务内更新订单与用户套餐）。"""
    # 1. 查询订单
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.deleted_at.is_(None))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundException("订单不存在")

    # 2. 幂等：已处理过的成功/失败流水不再处理
    if order.provider_transaction_id == request.transaction_id:
        if order.status == "paid":
            return order
        if order.status in ("cancelled", "refunded"):
            raise ValidationException("订单已关闭，无法重复处理")
    elif order.provider_transaction_id and order.provider_transaction_id != request.transaction_id:
        # 同一订单出现不同流水号，拒绝
        raise ValidationException("订单已存在其他支付流水")

    # 3. 失败回调：仅更新状态
    if request.status == "failed":
        if order.status == "pending":
            order.status = "cancelled"
        return order

    # 4. 成功回调：事务内更新订单 + 用户套餐
    order.status = "paid"
    order.provider_transaction_id = request.transaction_id
    order.paid_at = datetime.now(timezone.utc)

    # 套餐到期时间：若当前套餐同类型且未过期，则顺延；否则从当前时间起算
    user_result = await db.execute(select(User).where(User.id == order.user_id))
    user = user_result.scalar_one()

    now = datetime.now(timezone.utc)
    duration_days = get_plan_duration_days(order.type)  # type: ignore[arg-type]

    if user.plan == order.type and user.plan_expires_at and user.plan_expires_at > now:
        user.plan_expires_at = user.plan_expires_at + timedelta(days=duration_days)
    else:
        user.plan = order.type  # type: ignore[assignment]
        user.plan_expires_at = now + timedelta(days=duration_days)

    await db.flush()
    return order


async def check_paid_plan(user: User) -> None:
    """校验用户是否拥有有效付费套餐，否则抛出 ForbiddenException。"""
    if user.plan == "free":
        raise ForbiddenException("该功能需要付费套餐（单次解锁或订阅）")
    if user.plan_expires_at and user.plan_expires_at < datetime.now(timezone.utc):
        raise ForbiddenException("套餐已过期，请续费")
