"""安全工具（JWT 生成与验证）。"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import bcrypt
import jwt

from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码。

    Args:
        plain_password: 明文密码
        hashed_password: 哈希后的密码

    Returns:
        密码是否匹配
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def hash_password(password: str) -> str:
    """哈希密码。

    Args:
        password: 明文密码

    Returns:
        哈希后的密码
    """
    # bcrypt 限制 72 字节，截断超长密码
    hashed = bcrypt.hashpw(
        password.encode("utf-8")[:72],
        bcrypt.gensalt(),
    )
    return hashed.decode("utf-8")


def _create_token(
    user_id: UUID,
    expires_delta: Optional[timedelta],
    token_type: str,
) -> str:
    """生成 JWT token（access / refresh 通用内部实现）。"""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))

    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": now,
        "type": token_type,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_access_token(
    user_id: UUID,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """生成 JWT access token（默认 15 分钟）。"""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return _create_token(user_id, expires_delta, token_type="access")


def create_refresh_token(
    user_id: UUID,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """生成 JWT refresh token（默认 7 天）。"""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.JWT_REFRESH_EXPIRE_MINUTES)
    return _create_token(user_id, expires_delta, token_type="refresh")


def verify_token(token: str, expected_type: str = "access") -> Optional[dict]:
    """验证 JWT token。

    Args:
        token: JWT token 字符串
        expected_type: 期望的 token 类型（access / refresh）

    Returns:
        解码后的 payload（包含 sub, exp, iat, type），验证失败返回 None
    """
    if not settings.JWT_SECRET_KEY:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != expected_type:
            return None
        return payload
    except jwt.PyJWTError:
        # 捕获所有 JWT 相关异常（含 ExpiredSignatureError, InvalidTokenError, InvalidKeyError 等）
        return None
