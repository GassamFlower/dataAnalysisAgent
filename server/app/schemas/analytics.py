"""埋点相关 Schema。"""
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field


class TrackEventRequest(BaseModel):
    """埋点事件上报请求。"""
    event: str = Field(..., description="事件类型", max_length=100)
    project_id: Optional[UUID] = Field(None, description="关联项目 ID")
    user_id: Optional[UUID] = Field(None, description="用户 ID")
    metadata: Optional[Dict[str, Any]] = Field(None, description="事件元数据")
    timestamp: int = Field(..., description="前端时间戳（毫秒）")


class TrackEventResponse(BaseModel):
    """埋点事件上报响应。"""
    success: bool = True
    message: str = "Event tracked"


class MetricsQueryRequest(BaseModel):
    """指标查询请求。"""
    start_date: Optional[datetime] = Field(None, description="开始时间")
    end_date: Optional[datetime] = Field(None, description="结束时间")
    event_types: Optional[list[str]] = Field(None, description="事件类型列表")


class DailyMetrics(BaseModel):
    """每日指标。"""
    date: str
    registrations: int = 0
    reports_generated: int = 0
    reports_exported: int = 0
    payments_completed: int = 0
    unique_users: int = 0


class ConversionMetrics(BaseModel):
    """转化指标。"""
    register_conversion_rate: float = 0.0  # 注册转化率
    report_completion_rate: float = 0.0    # 报告完成率
    payment_conversion_rate: float = 0.0   # 付费转化率
    total_registrations: int = 0
    total_reports: int = 0
    total_payments: int = 0


class MetricsResponse(BaseModel):
    """指标查询响应。"""
    daily: list[DailyMetrics] = []
    conversion: ConversionMetrics = ConversionMetrics()
    period_days: int = 7
