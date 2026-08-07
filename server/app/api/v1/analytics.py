"""埋点与指标查询 API。"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_user_optional
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.analytics_event import AnalyticsEvent
from app.schemas.analytics import (
    TrackEventRequest,
    TrackEventResponse,
    MetricsResponse,
    DailyMetrics,
    ConversionMetrics,
)
from app.services.project_service import get_owned_project

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post(
    "/track",
    response_model=TrackEventResponse,
    summary="上报埋点事件",
    description="接收前端埋点事件并存储。可选登录：已登录则 user_id 由服务端从 token 派生（忽略客户端传入值），"
                "project_id 校验归属；未登录只允许匿名事件（user_id 记为空）。",
)
async def track_event(
    request: Request,
    event_data: TrackEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """上报埋点事件。

    安全规则（防伪造）：
    1. user_id 一律由服务端决定：已登录 → token 中的用户 ID；未登录 → None。
       客户端请求体传入的 user_id 被忽略，防止任意伪造他人埋点。
    2. project_id 若由客户端传入：
       - 已登录 → 必须属于当前用户（get_owned_project），否则拒绝。
       - 未登录 → 不可信，置为 None（匿名事件不归属任何项目）。
    """
    # 提取客户端 IP
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:500]

    # user_id 服务端派生，不信任客户端值
    trusted_user_id = current_user["id"] if current_user else None

    # project_id 归属校验：已登录才允许归属项目，且必须是本人项目
    trusted_project_id = event_data.project_id
    if trusted_project_id is not None:
        if current_user is None:
            # 未登录不可归属任意项目（匿名事件不携带项目归属）
            trusted_project_id = None
        else:
            # 已登录：校验项目属于当前用户，防止给他人项目伪造事件
            try:
                await get_owned_project(db, trusted_project_id, current_user["id"])
            except NotFoundException:
                trusted_project_id = None

    # 创建事件记录
    event = AnalyticsEvent(
        event_type=event_data.event,
        user_id=trusted_user_id,
        project_id=trusted_project_id,
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
    # 检查管理员权限（统一走 ForbiddenException，保证响应格式一致）
    if not current_user.get("is_admin"):
        raise ForbiddenException("需要管理员权限")

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
