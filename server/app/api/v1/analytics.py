"""埋点与指标查询 API。"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.analytics_event import AnalyticsEvent
from app.schemas.analytics import (
    TrackEventRequest,
    TrackEventResponse,
    MetricsResponse,
    DailyMetrics,
    ConversionMetrics,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post(
    "/track",
    response_model=TrackEventResponse,
    summary="上报埋点事件",
    description="接收前端埋点事件并存储",
)
async def track_event(
    request: Request,
    event_data: TrackEventRequest,
    db: AsyncSession = Depends(get_db),
):
    """上报埋点事件。"""
    # 提取客户端 IP
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:500]

    # 创建事件记录
    event = AnalyticsEvent(
        event_type=event_data.event,
        user_id=event_data.user_id,
        project_id=event_data.project_id,
        metadata_json=event_data.metadata,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.fromtimestamp(
            event_data.timestamp / 1000, tz=timezone.utc
        ),
    )

    db.add(event)
    await db.commit()

    return TrackEventResponse(success=True)


@router.get(
    "/metrics",
    response_model=MetricsResponse,
    summary="查询业务指标",
    description="查询核心业务指标（需管理员权限）",
)
async def get_metrics(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """查询核心业务指标。"""
    # 检查管理员权限
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)

    # 每日统计
    daily_query = (
        select(
            func.date(AnalyticsEvent.created_at).label("date"),
            func.count().filter(AnalyticsEvent.event_type == "register_success").label("registrations"),
            func.count().filter(AnalyticsEvent.event_type == "report_analyze_success").label("reports_generated"),
            func.count().filter(AnalyticsEvent.event_type == "report_export_success").label("reports_exported"),
            func.count().filter(AnalyticsEvent.event_type == "payment_success").label("payments_completed"),
            func.count(func.distinct(AnalyticsEvent.user_id)).label("unique_users"),
        )
        .where(
            and_(
                AnalyticsEvent.created_at >= start_date,
                AnalyticsEvent.created_at <= end_date,
            )
        )
        .group_by(func.date(AnalyticsEvent.created_at))
        .order_by(func.date(AnalyticsEvent.created_at))
    )

    result = await db.execute(daily_query)
    daily_rows = result.all()

    daily_metrics = [
        DailyMetrics(
            date=str(row.date),
            registrations=row.registrations or 0,
            reports_generated=row.reports_generated or 0,
            reports_exported=row.reports_exported or 0,
            payments_completed=row.payments_completed or 0,
            unique_users=row.unique_users or 0,
        )
        for row in daily_rows
    ]

    # 转化率计算
    total_registrations = sum(d.registrations for d in daily_metrics)
    total_reports = sum(d.reports_generated for d in daily_metrics)
    total_payments = sum(d.payments_completed for d in daily_metrics)

    # 注册转化率 = 注册成功数 / 注册页面访问数
    register_page_views = await db.execute(
        select(func.count())
        .where(
            and_(
                AnalyticsEvent.event_type == "register_page_view",
                AnalyticsEvent.created_at >= start_date,
            )
        )
    )
    register_pv = register_page_views.scalar() or 1
    register_conversion_rate = (total_registrations / register_pv * 100) if register_pv > 0 else 0

    # 报告完成率 = 报告生成成功数 / 报告分析开始数
    report_starts = await db.execute(
        select(func.count())
        .where(
            and_(
                AnalyticsEvent.event_type == "report_analyze_start",
                AnalyticsEvent.created_at >= start_date,
            )
        )
    )
    report_start_count = report_starts.scalar() or 1
    report_completion_rate = (total_reports / report_start_count * 100) if report_start_count > 0 else 0

    # 付费转化率 = 付费成功数 / 定价页访问数
    pricing_page_views = await db.execute(
        select(func.count())
        .where(
            and_(
                AnalyticsEvent.event_type == "pricing_page_view",
                AnalyticsEvent.created_at >= start_date,
            )
        )
    )
    pricing_pv = pricing_page_views.scalar() or 1
    payment_conversion_rate = (total_payments / pricing_pv * 100) if pricing_pv > 0 else 0

    conversion = ConversionMetrics(
        register_conversion_rate=round(register_conversion_rate, 2),
        report_completion_rate=round(report_completion_rate, 2),
        payment_conversion_rate=round(payment_conversion_rate, 2),
        total_registrations=total_registrations,
        total_reports=total_reports,
        total_payments=total_payments,
    )

    return MetricsResponse(
        daily=daily_metrics,
        conversion=conversion,
        period_days=days,
    )
