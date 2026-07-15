"""安全工具（JWT 生成与验证）。"""
from datetime import datetime, timedelta
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


def create_access_token(
    user_id: UUID,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """生成 JWT access token。

    Args:
        user_id: 用户 ID
        expires_delta: 过期时间增量（默认 7 天）

    Returns:
        JWT token 字符串
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """验证 JWT token。

    Args:
        token: JWT token 字符串

    Returns:
        解码后的 payload（包含 sub, exp, iat），验证失败返回 None
    """
    if not settings.JWT_SECRET_KEY:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except jwt.PyJWTError:
        # 捕获所有 JWT 相关异常（含 ExpiredSignatureError, InvalidTokenError, InvalidKeyError 等）
        return None
