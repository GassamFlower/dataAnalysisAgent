"""支付/订阅路由。"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException, NotFoundException, UnauthorizedException
from app.core.responses import ResponseModel
from app.core.error_messages import ERR_USER_NOT_FOUND
from app.models.user import User
from app.schemas.payment import (
    OrderCreateRequest,
    OrderListResponse,
    OrderNotifyRequest,
    OrderNotifyResponse,
    OrderResponse,
    SubscriptionResponse,
)
from app.services import payment_service, quota_service
from app.services.audit_service import AuditService, ACTION_TYPES

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
        raise NotFoundException(ERR_USER_NOT_FOUND)

    status = payment_service.get_subscription_status(user)
    return ResponseModel(data=SubscriptionResponse(**status))


@router.get(
    "/quota",
    summary="当前用户本周用量额度",
    description="返回当前用户各操作类型的本周已用次数、上限及剩余次数。",
)
async def get_quota(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """获取当前用户本周用量额度。"""
    user = await db.get(User, current_user["id"])
    if not user:
        raise NotFoundException(ERR_USER_NOT_FOUND)

    status = payment_service.get_subscription_status(user)
    plan = status.get("plan_type", "free")
    quota = await quota_service.get_quota_status(db, current_user["id"], plan)
    return ResponseModel(data=quota)


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


def _verify_payment_callback(request: Request) -> None:
    """校验支付回调请求的合法性与来源。

    校验顺序：
    1. DEBUG 模式放行（开发/测试环境，便于本地联调）
    2. X-Payment-Signature 请求头与配置的 PAYMENT_CALLBACK_TOKEN 恒时比对
    3. 请求 IP 在 PAYMENT_ALLOWED_IPS 白名单内（生产必配，缺失即拒绝）

    生产环境必须同时配置 PAYMENT_CALLBACK_TOKEN 与 PAYMENT_ALLOWED_IPS，
    否则回调一律拒绝（防止"仅静态 token"单点防护被绕过）。
    """
    from secrets import compare_digest

    if settings.DEBUG:
        return

    # 1. 签名校验（存在性 + 恒时比较，防时序侧信道）
    token = settings.PAYMENT_CALLBACK_TOKEN
    if not token:
        raise UnauthorizedException("支付回调未配置签名 token，拒绝访问")
    signature = request.headers.get("X-Payment-Signature", "")
    if not signature or not compare_digest(signature.encode("utf-8"), token.encode("utf-8")):
        raise UnauthorizedException("支付回调签名校验失败")

    # 2. IP 白名单（生产必配：缺失即拒绝，不再"可配可不配"）
    allowed_ips_str = settings.PAYMENT_ALLOWED_IPS
    allowed_ips = {
        ip.strip() for ip in allowed_ips_str.split(",") if ip.strip()
    } if allowed_ips_str else set()
    if not settings.DEBUG and not allowed_ips:
        raise UnauthorizedException("PAYMENT_ALLOWED_IPS 未配置，拒绝回调（生产环境必须配置支付渠道 IP 白名单）")
    client_ip = request.client.host if request.client else ""
    if client_ip and client_ip not in allowed_ips:
        raise UnauthorizedException(f"请求 IP {client_ip} 不在支付回调白名单内")


@router.post(
    "/orders/{order_id}/notify",
    response_model=ResponseModel[OrderNotifyResponse],
    summary="支付回调",
    description="支付渠道回调接口。通过签名 token + IP 白名单校验，无登录态要求。成功则更新订单状态并激活用户套餐。",
)
async def payment_notify(
    order_id: UUID,
    request: OrderNotifyRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """处理支付回调。

    安全策略：
    - 不要求登录态（支付渠道服务端触发，无 JWT）
    - DEBUG 模式放行（开发联调）
    - 生产环境校验 X-Payment-Signature 与 IP 白名单
    - 通过 order_id 直接查询订单（不再过滤 user_id）
    """
    _verify_payment_callback(http_request)

    # 按 order_id 处理（不限制 user_id，回调无登录态；process 内部含金额核验、幂等与行锁）
    order = await payment_service.process_payment_notification(db, order_id, request)

    # 记录审计日志
    await AuditService.log_action(
        db=db,
        user_id=order.user_id,
        action_type=ACTION_TYPES["PAYMENT_NOTIFY"],
        action_detail={
            "order_id": str(order_id),
            "channel": request.channel,
            "transaction_id": request.transaction_id,
            "status": request.status,
        },
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent"),
    )

    return ResponseModel(
        data=OrderNotifyResponse(success=True, message="支付处理成功")
    )
