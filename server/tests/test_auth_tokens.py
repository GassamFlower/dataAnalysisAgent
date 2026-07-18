"""认证双 token 机制测试（R3 验收）。

覆盖：
- dev-login 签发 access + refresh 双 token
- access token 可正常访问受保护接口
- access token 过期/伪造返回 401
- refresh token 可换发新的双 token（rotation）
- 旧的 refresh token 在刷新后失效
- logout 清空 refresh token，使 refresh 失效
"""

from datetime import timedelta

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.security import create_access_token


@pytest.fixture(autouse=True)
def ensure_jwt_secret():
    """确保测试环境有 JWT 密钥，避免空 key 导致 jwt.encode 失败。"""
    if not settings.JWT_SECRET_KEY:
        settings.JWT_SECRET_KEY = "test-jwt-secret-do-not-use-in-production"


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
