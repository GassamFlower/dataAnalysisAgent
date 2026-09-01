"""支付/订阅路由。"""
from __future__ import annotations

import json
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException, NotFoundException, UnauthorizedException
from app.core.responses import ResponseModel
from app.core.error_messages import ERR_USER_NOT_FOUND
from app.models.user import User
from app.models.order import Order
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
from app.services.wechat_pay import (
    create_native_order,
    decrypt_notify_resource,
    verify_notify_signature,
)

router = APIRouter(prefix="/payment", tags=["payment"])


def _require_online_payment_enabled() -> None:
    """线上成交开关（线下成交转最小可行方案，Step 2）。

    生产默认 ENABLE_ONLINE_PAYMENT=False，此时在线下单/支付回调一律拒绝，
    完整能力仅由后台「线下订单」手动开通。
    """
    if not settings.ENABLE_ONLINE_PAYMENT:
        raise ForbiddenException(
            "在线支付已关闭，完整能力请联系客服开通（线下成交模式）"
        )


def parse_order_id(out_trade_no: str) -> Optional[UUID]:
    """把微信回调 out_trade_no（Order.id 的 32 位 hex）解析回 UUID。

    本项目下单时 out_trade_no = str(order.id).replace('-', '')，即 32 位 hex。
    微信回调原样返回该值；此处还原成标准 UUID（8-4-4-4-12）。
    """
    s = out_trade_no.strip().replace("-", "")
    if len(s) != 32:
        return None
    try:
        return UUID(f"{s[0:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:32]}")
    except ValueError:
        return None


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
    _require_online_payment_enabled()
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
    - 线上成交模式关闭时拒绝（生产默认关闭，见 _require_online_payment_enabled）
    - DEBUG 模式放行（开发联调）
    - 生产环境校验 X-Payment-Signature 与 IP 白名单
    - 通过 order_id 直接查询订单（不再过滤 user_id）
    """
    _require_online_payment_enabled()
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


@router.post(
    "/wxpay/{order_id}/qr",
    response_model=ResponseModel,
    summary="微信 Native 下单（返回支付二维码 code_url）",
    description="为已有 pending 订单发起微信支付 Native 下单，返回 code_url（前端生成二维码）。",
)
async def wechat_pay_qr(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """为订单发起微信 Native 支付，返回 code_url 供前端生成二维码。

    - 仅订单本人可发起
    - 仅 pending 订单可支付
    - 金额由服务端读取订单（不让前端传），杜绝改价
    """
    _require_online_payment_enabled()
    order = await payment_service.get_order_detail(
        db, current_user["id"], order_id
    )
    if order.status != "pending":
        from app.core.exceptions import ValidationException
        raise ValidationException(f"订单当前状态为 {order.status}，不可支付")

    plan_label = "月度订阅" if order.type == "subscription" else "单次报告"
    code_url = await create_native_order(
        out_trade_no=str(order.id).replace("-", ""),
        description=plan_label,
        amount=order.amount,
        notify_url="",  # 用 settings.WXPAY_NOTIFY_URL（已配置时）
    )
    return ResponseModel(data={"code_url": code_url, "order_id": str(order_id)})


@router.post(
    "/wxpay/notify",
    summary="微信支付结果回调（官方验签 + 解密码）",
    description="微信服务器回调：验签 → 解密 → 校验金额 → 更新订单 → 激活套餐。无需登录。",
)
async def wechat_pay_notify(
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """微信支付 v3 回调（统一下单 notify_url 指向此处）。

    流程：取 Wechatpay-Timestamp / Nonce / Signature 请求头 →
    验签 → 解析 JSON → 解密 resource → 校验 order 状态与金额 → 更新。
    """
    _require_online_payment_enabled()
    # 读取原始请求体（明文 JSON）
    raw_body = await http_request.body()
    body_text = raw_body.decode("utf-8")

    # 微信官方回调验签 header
    wx_timestamp = http_request.headers.get("Wechatpay-Timestamp", "")
    wx_nonce = http_request.headers.get("Wechatpay-Nonce", "")
    wx_serial = http_request.headers.get("Wechatpay-Serial", "")
    wx_signature = http_request.headers.get("Wechatpay-Signature", "")

    if not verify_notify_signature(
        method="POST",
        url_path="/api/v1/payment/wxpay/notify",
        timestamp=wx_timestamp,
        nonce=wx_nonce,
        body=body_text,
        signature=wx_signature,
    ):
        from app.core.exceptions import UnauthorizedException

        raise UnauthorizedException("微信回调验签失败")

    # 2. 解析根 JSON，取 resource
    try:
        root = json.loads(body_text)
    except Exception:  # noqa: BLE001
        from app.core.exceptions import ValidationException

        raise ValidationException("回调 JSON 解析失败")
    resource = root.get("resource") or {}

    # 3. 解密 resource（AES-256-GCM）
    plain_json = decrypt_notify_resource(resource)
    try:
        biz = json.loads(plain_json)
    except Exception:  # noqa: BLE001
        from app.core.exceptions import ValidationException

        raise ValidationException("回调明文解析失败")

    out_trade_no = biz.get("out_trade_no", "")
    trade_state = biz.get("trade_state", "")
    transaction_id = biz.get("transaction_id", "")
    if len(out_trade_no) > 32:
        # 本项目 Order.id 的 hex（32位），微信可能返回原样；这里兼容解析
        out_trade_no = out_trade_no[:32]

    # 4. 找到本地订单（out_trade_no == Order.id 去连字符 hex）
    order_id = parse_order_id(out_trade_no)
    if not order_id:
        from app.core.exceptions import NotFoundException

        raise NotFoundException("回调订单号无法解析")

    # 5. 处理成功：复用 process_payment_notification 语义，但构造 request
    if trade_state == "SUCCESS":
        # 金额对齐：微信回调 amount.total（分）→ 元
        amount_fen = (biz.get("amount") or {}).get("total")
        amount_yuan = Decimal(amount_fen) / 100 if amount_fen is not None else None
        notify_request = OrderNotifyRequest(
            channel="wechat",
            transaction_id=transaction_id or out_trade_no,
            status="success",
            amount=amount_yuan,
        )
        order = await payment_service.process_payment_notification(
            db, order_id, notify_request
        )
        await AuditService.log_action(
            db=db,
            user_id=order.user_id,
            action_type=ACTION_TYPES["PAYMENT_NOTIFY"],
            action_detail={
                "order_id": str(order.id),
                "channel": "wechat",
                "transaction_id": transaction_id,
                "status": "success",
            },
            ip_address=http_request.client.host if http_request.client else None,
        )
        # 微信要求回调返回 200
        return ResponseModel(data={"code": "SUCCESS", "message": "OK"})
    else:
        # 失败回调：仅更新状态，返回成功响应避免渠道重试
        notify_request = OrderNotifyRequest(
            channel="wechat",
            transaction_id=transaction_id or out_trade_no,
            status="failed",
        )
        await payment_service.process_payment_notification(db, order_id, notify_request)
        return ResponseModel(data={"code": "FAIL", "message": "订单未支付"})
