"""管理后台服务层（bootstrap 晋升 + 运营查询辅助）。"""
import logging
import uuid
from typing import List, Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.project import Project
from app.models.user import User

logger = logging.getLogger(__name__)

# 合法套餐枚举（与 users 表 ck_users_plan 一致）
VALID_PLANS = {"free", "single", "subscription"}


# ── bootstrap：初始管理员晋升（立项 G1）───────────────────────────────


async def promote_emails(db: AsyncSession, emails: Sequence[str]) -> dict:
    """将指定邮箱对应的账号晋升为管理员（is_admin=True）。

    只晋升已存在的、非软删的用户；不存在则跳过并记录。
    返回 {promoted: [...], not_found: [...], already: int}。
    """
    promoted, not_found, already = [], [], 0
    for raw in emails:
        email = (raw or "").strip().lower()
        if not email:
            continue
        res = await db.execute(select(User).where(func.lower(User.email) == email))
        user = res.scalar_one_or_none()
        if not user:
            not_found.append(email)
            continue
        if user.is_admin:
            already += 1
            continue
        user.is_admin = True
        promoted.append(email)
    await db.commit()
    logger.info("ADMIN bootstrap: promoted=%s not_found=%s already=%d",
                promoted, not_found, already)
    return {"promoted": promoted, "not_found": not_found, "already": already}


async def promote_configured_emails(db: AsyncSession) -> None:
    """启动阶段：把 settings.ADMIN_EMAILS 中声明的邮箱自动晋升为管理员。"""
    emails = [e.strip() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    if not emails:
        return
    await promote_emails(db, emails)


# ------------------------------------------------------------------------


def user_admin_dict(user: User) -> dict:
    """管理端用户序列化（含脱敏）。"""
    email = None
    if user.email:
        local, _, domain = user.email.partition("@")
        email = f"{local[:1]}***@{domain}" if len(local) > 2 else "***@" + domain
    return {
        "id": str(user.id),
        "email": user.email,
        "email_masked": email,
        "nickname": user.nickname,
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "is_admin": user.is_admin,
        "email_verified": user.email_verified,
        "disabled": user.disabled_at is not None,
        "disabled_at": user.disabled_at.isoformat() if user.disabled_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


async def get_user_project_counts(
    db: AsyncSession, user_ids: List[str]
) -> dict:
    """一次查询多用户的未删除项目数。"""
    ids = [_uuid(u) for u in user_ids if _uuid(u)]
    if not ids:
        return {}
    res = await db.execute(
        select(Project.user_id, func.count(Project.id))
        .where(Project.user_id.in_(ids), Project.deleted_at.is_(None))
        .group_by(Project.user_id)
    )
    return {str(uid): cnt for uid, cnt in res.all()}


def _uuid(v: str):
    try:
        return uuid.UUID(str(v))
    except ValueError:
        return None