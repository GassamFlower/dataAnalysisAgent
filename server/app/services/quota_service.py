"""用户用量服务。

按自然周统计免费用户的模拟生成/报告导出/高级统计调用次数。
付费用户（single/subscription）不限次数，不记录用量。
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException
from app.models.user_quota import UserQuota

# 免费额度配置（每周）
FREE_LIMITS = {
    "simulation": 6,
    "export": 6,
    "analysis": 6,
}


def get_week_period_key(dt: Optional[datetime] = None) -> str:
    """获取当前自然周的 period_key（ISO 格式 YYYY-Www）。"""
    if dt is None:
        dt = datetime.now(timezone.utc)
    iso = dt.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def get_week_reset_at(dt: Optional[datetime] = None) -> datetime:
    """获取当前自然周结束时间（下周一 00:00 UTC）。"""
    if dt is None:
        dt = datetime.now(timezone.utc)
    days_until_monday = (7 - dt.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    next_monday = dt.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=days_until_monday)
    return next_monday


async def check_and_consume_quota(
    db: AsyncSession,
    user_id: uuid.UUID,
    action_type: str,
    plan: str,
) -> None:
    """校验并扣减免费额度（原子操作）。

    付费用户直接放行。免费用户校验周用量，超限抛出 ForbiddenException，
    未超限则立即扣减。

    Args:
        db: 数据库会话
        user_id: 用户 ID
        action_type: 操作类型（simulation/export/analysis）
        plan: 用户套餐（free/single/subscription）
    """
    if plan != "free":
        return

    limit = FREE_LIMITS.get(action_type, 3)
    period_key = get_week_period_key()
    reset_at = get_week_reset_at()

    result = await db.execute(
        select(UserQuota).where(
            UserQuota.user_id == user_id,
            UserQuota.action_type == action_type,
            UserQuota.period_key == period_key,
        )
    )
    quota = result.scalar_one_or_none()

    used = quota.used_count if quota else 0
    if used >= limit:
        raise ForbiddenException(
            f"本周{action_type}次数已达上限（{limit}次），"
            f"下周一（{reset_at.strftime('%m-%d')}）重置，或升级套餐解锁无限次数",
            details={
                "limit": limit,
                "used": used,
                "reset_at": reset_at.isoformat(),
            },
        )

    # 扣减
    if quota:
        quota.used_count += 1
    else:
        quota = UserQuota(
            user_id=user_id,
            action_type=action_type,
            period_key=period_key,
            used_count=1,
            max_count=limit,
            reset_at=reset_at,
        )
        db.add(quota)


async def get_quota_status(
    db: AsyncSession,
    user_id: uuid.UUID,
    plan: str,
) -> dict:
    """获取用户当前周用量状态。"""
    period_key = get_week_period_key()
    reset_at = get_week_reset_at()

    result = await db.execute(
        select(UserQuota).where(
            UserQuota.user_id == user_id,
            UserQuota.period_key == period_key,
        )
    )
    quotas = result.scalars().all()

    quota_map = {q.action_type: q.used_count for q in quotas}

    return {
        "plan": plan,
        "period": period_key,
        "reset_at": reset_at.isoformat(),
        "quotas": {
            action: {
                "used": quota_map.get(action, 0),
                "limit": limit,
                "remaining": max(0, limit - quota_map.get(action, 0)),
            }
            for action, limit in FREE_LIMITS.items()
        },
    }
