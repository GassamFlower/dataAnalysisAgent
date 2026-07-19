"""公共依赖（认证 + 权限）。"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.core.security import verify_token
from app.models.user import User

security = HTTPBearer(auto_error=False)

# 开发模式固定用户（dev-token 对应）
DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取当前用户。

    支持两种认证方式：
    1. JWT token（生产环境）
    2. dev-token（仅 DEBUG 模式，用于开发测试）
    """
    if not credentials:
        raise UnauthorizedException("未提供认证凭据")

    token = credentials.credentials

    # 开发模式：允许 dev-token
    if settings.DEBUG and settings.ALLOW_DEV_TOKEN and token == settings.DEV_TOKEN:
        user = await db.get(User, DEV_USER_ID)
        if not user:
            user = User(
                id=DEV_USER_ID,
                openid="dev-openid",
                nickname="开发者",
                plan="subscription",
            )
            db.add(user)
            await db.flush()
        return {
        "id": user.id,
        "email": user.email,
        "nickname": user.nickname,
        "email_verified": user.email_verified,
        "is_admin": True,
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at,
    }

    # JWT 验证
    payload = verify_token(token)
    if not payload:
        raise UnauthorizedException("无效的认证凭据")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException("无效的认证凭据")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException("无效的认证凭据")

    user = await db.get(User, user_id)
    if not user:
        raise UnauthorizedException("用户不存在")

    return {
        "id": user.id,
        "email": user.email,
        "nickname": user.nickname,
        "email_verified": user.email_verified,
        "is_admin": user.is_admin,
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at,
    }


async def require_paid_plan(user: dict = Depends(get_current_user)) -> dict:
    """要求付费套餐（single / subscription）。

    免费层只能用 V1（上传解析）+ V2（题目体检），V3~V8 需付费解锁。
    """
    if user["plan"] == "free":
        raise ForbiddenException("该功能需要付费套餐（单次解锁或订阅）")
    if user["plan_expires_at"] and user["plan_expires_at"] < datetime.now(timezone.utc):
        raise ForbiddenException("套餐已过期，请续费")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """要求管理员权限。"""
    if not user.get("is_admin"):
        raise ForbiddenException("需要管理员权限")
    return user
