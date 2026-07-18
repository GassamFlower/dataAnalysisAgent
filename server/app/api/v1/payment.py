"""支付/订阅路由。"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException, NotFoundException
from app.core.responses import ResponseModel
from app.models.user import User
from app.schemas.payment import (
    OrderCreateRequest,
    OrderListResponse,
    OrderNotifyRequest,
    OrderNotifyResponse,
    OrderResponse,
    SubscriptionResponse,
)
from app.services import payment_service

router = APIRouter(prefix="/payment", tags=["payment"])


@router.get(
    "/subscription",
    response_model=ResponseModel[SubscriptionResponse],
    summary="当前用户套餐状态",
    description="返回当前登录用户的套餐类型、有效期、是否有效及能力列表。",
)
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """获取当前用户套餐状态。"""
    user = await db.get(User, current_user["id"])
    if not user:
        raise NotFoundException("用户不存在")

    status = payment_service.get_subscription_status(user)
    return ResponseModel(data=SubscriptionResponse(**status))


@router.post(
    "/orders",
    response_model=ResponseModel[OrderResponse],
    summary="创建订单",
    description="创建单次报告或月度订阅订单，金额由服务端决定。",
)
async def create_order(
    request: OrderCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """创建订单。"""
    order = await payment_service.create_order(db, current_user["id"], request)
    return ResponseModel(data=order)


@router.get(
    "/orders",
    response_model=ResponseModel[OrderListResponse],
    summary="订单列表",
    description="查询当前用户的订单列表，支持分页。",
)
async def list_orders(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """查询订单列表。"""
    orders, total = await payment_service.list_orders(
        db, current_user["id"], page=page, page_size=page_size
    )
    return ResponseModel(
        data=OrderListResponse(
            orders=orders,
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.get(
    "/orders/{order_id}",
    response_model=ResponseModel[OrderResponse],
    summary="订单详情",
    description="查询指定订单详情，仅允许订单所有者查看。",
)
async def get_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """查询订单详情。"""
    order = await payment_service.get_order_detail(db, current_user["id"], order_id)
    return ResponseModel(data=order)


@router.post(
    "/orders/{order_id}/notify",
    response_model=ResponseModel[OrderNotifyResponse],
    summary="支付回调",
    description="支付渠道回调接口（本轮为 mock 签名）。成功则更新订单状态并激活用户套餐。",
)
async def payment_notify(
    order_id: UUID,
    request: OrderNotifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """处理支付回调。

    注意：真实微信支付回调应由渠道服务端触发，需校验签名与 IP 白名单。
    本轮为开发验证，允许登录用户直接调用以模拟支付成功。
    """
    # 简单权限校验：仅允许订单所有者或管理员触发（mock 阶段）
    order = await payment_service.get_order_detail(db, current_user["id"], order_id)
    if order.user_id != current_user["id"] and not current_user.get("is_admin"):
        raise ForbiddenException("无权处理该订单")

    await payment_service.process_payment_notification(db, order_id, request)
    return ResponseModel(
        data=OrderNotifyResponse(success=True, message="支付处理成功")
    )
