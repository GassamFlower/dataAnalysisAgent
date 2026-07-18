"""认证双 token 机制测试（R3 验收）。

覆盖：
- dev-login 签发 access + refresh 双 token
- access token 可正常访问受保护接口
- access token 过期/伪造返回 401
- refresh token 可换发新的双 token（rotation）
- 旧的 refresh token 在刷新后失效
- logout 清空 refresh token，使 refresh 失效
"""

import uuid
from datetime import timedelta

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.api.v1.auth import (
    _create_reset_token,
    _hash_email_verification_code,
    _verify_reset_token,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.user import User


@pytest.fixture(autouse=True)
def ensure_jwt_secret():
    """确保测试环境有 JWT 与密码重置 JWT 密钥，避免空 key 导致 jwt.encode 失败。"""
    if not settings.JWT_SECRET_KEY:
        settings.JWT_SECRET_KEY = "test-jwt-secret-do-not-use-in-production"
    if not settings.RESET_JWT_SECRET_KEY:
        settings.RESET_JWT_SECRET_KEY = "test-reset-jwt-secret-do-not-use-in-production"


@pytest.mark.anyio
async def test_dev_login_issues_dual_tokens(client: AsyncClient):
    """dev-login 返回双 token 与用户信息。"""
    resp = await client.post("/api/v1/auth/dev-login")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["nickname"] == "测试用户"


@pytest.mark.anyio
async def test_access_token_protects_endpoints(client: AsyncClient):
    """有效 access token 可访问受保护接口，无效/过期返回 401。"""
    login = await client.post("/api/v1/auth/dev-login")
    access_token = login.json()["data"]["access_token"]

    resp = await client.get(
        "/api/v1/projects/",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200

    # 伪造 token
    resp_invalid = await client.get(
        "/api/v1/projects/",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert resp_invalid.status_code == 401

    # 过期 token（使用登录返回的用户 ID）
    user_id = login.json()["data"]["user"]["id"]
    expired_token = create_access_token(
        user_id,
        expires_delta=timedelta(seconds=-1),
    )
    resp_expired = await client.get(
        "/api/v1/projects/",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp_expired.status_code == 401


@pytest.mark.anyio
async def test_refresh_token_rotation(client: AsyncClient):
    """refresh 换发新双 token，旧 refresh token 失效。"""
    login = await client.post("/api/v1/auth/dev-login")
    login_data = login.json()["data"]
    old_refresh = login_data["refresh_token"]
    old_access = login_data["access_token"]

    # 第一次 refresh
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()["data"]
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens

    # 新 access token 可用
    protected = await client.get(
        "/api/v1/projects/",
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
    )
    assert protected.status_code == 200

    # 旧 access token 仍过期/旧 refresh 已失效
    old_refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert old_refresh_resp.status_code == 401


@pytest.mark.anyio
async def test_logout_invalidates_refresh_token(client: AsyncClient):
    """退出登录后 refresh token 无法继续使用。"""
    login = await client.post("/api/v1/auth/dev-login")
    tokens = login.json()["data"]

    # 退出登录
    logout_resp = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert logout_resp.status_code == 200

    # 退出后再用原 refresh token 换发应失败
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert refresh_resp.status_code == 401


@pytest.mark.anyio
async def test_reset_token_uses_independent_secret(client: AsyncClient):
    """密码重置 token 必须使用独立的 RESET_JWT_SECRET_KEY 签发与验证。"""
    user_id = uuid.uuid4()
    token = _create_reset_token(user_id)

    # 独立密钥可验证
    assert _verify_reset_token(token) == user_id

    # 登录 JWT 密钥不应能解码该 token
    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


@pytest.mark.anyio
async def test_email_verification_code_is_hashed(client: AsyncClient):
    """邮箱验证码入库为哈希，且仅正确明文可通过验证。"""
    email = f"test-hash-{uuid.uuid4().hex}@example.com"
    password = "123456"

    # 注册会创建用户（SMTP 未配置时邮件发送失败，但用户已落库）
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "nickname": "Hash Test"},
    )
    assert resp.status_code == 200

    # 在数据库中写入一个已知哈希的验证码
    async for db in get_db():
        user = (
            await db.execute(select(User).where(User.email == email))
        ).scalar_one()
        assert user.email_verify_code_hash is not None
        assert user.email_verify_code_hash != "123456"  # 不是明文
        user.email_verify_code_hash = _hash_email_verification_code("654321")
        await db.commit()
        break

    # 正确验证码通过
    ok_resp = await client.post(
        "/api/v1/auth/verify-email",
        json={"email": email, "code": "654321"},
    )
    assert ok_resp.status_code == 200
    assert "access_token" in ok_resp.json()["data"]

    # 错误验证码失败
    bad_resp = await client.post(
        "/api/v1/auth/verify-email",
        json={"email": email, "code": "000000"},
    )
    assert bad_resp.status_code == 400
