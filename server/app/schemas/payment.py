"""支付/订阅相关 Schema。"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


PlanType = Literal["free", "single", "subscription"]
OrderType = Literal["single", "subscription"]
OrderStatus = Literal["pending", "paid", "refunded", "cancelled"]
PaymentChannel = Literal["wechat", "alipay"]


class SubscriptionResponse(BaseModel):
    """当前用户套餐状态响应。"""

    plan: PlanType
    expires_at: Optional[datetime] = None
    is_active: bool = False
    features: List[str] = []

    model_config = ConfigDict(from_attributes=True)


class OrderCreateRequest(BaseModel):
    """创建订单请求。"""

    plan_type: OrderType = Field(..., description="订单类型：single 单次报告 / subscription 月度订阅")
    project_id: Optional[UUID] = Field(None, description="关联项目 ID（可选）")


class OrderResponse(BaseModel):
    """订单响应。"""

    id: UUID
    user_id: UUID
    project_id: Optional[UUID] = None
    type: OrderType
    amount: Decimal
    status: OrderStatus
    provider_transaction_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderListResponse(BaseModel):
    """订单列表响应。"""

    orders: List[OrderResponse]
    total: int
    page: int
    page_size: int


class OrderNotifyRequest(BaseModel):
    """支付回调请求。"""

    channel: PaymentChannel = Field(..., description="支付渠道")
    transaction_id: str = Field(..., min_length=1, description="第三方支付流水号")
    status: Literal["success", "failed"] = Field(..., description="支付结果")


class OrderNotifyResponse(BaseModel):
    """支付回调响应。"""

    success: bool
    message: str
