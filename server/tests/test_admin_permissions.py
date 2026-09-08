"""管理后台「管理员授权管理」测试（F-ADM-006）。

覆盖：
1. POST /admin/permissions 授予子管理员模块（可带天数/日期，含校验）。
2. GET /admin/permissions 超管列出管理员 + 授权。
3. PATCH /admin/permissions/{uid}/{module} 更新授权到期。
4. DELETE /admin/permissions/{uid}/{module} 撤销授权（无剩余授权则退回普通用户）。
5. DELETE /admin/permissions/user/{uid} 整体移除管理员身份。
6. require_module 按模块访问控制：受限子管理员只能访问被授予模块；
   历史管理员（无授权记录）拥有全部模块。
7. 到期授权自动失效。
8. 用户套餐到期时间（changePlan）必须晚于当前时刻。
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select

from app.core.database import get_db
from app.models.admin_permission import AdminPermission
from app.models.user import User

DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def _set_admin(is_admin=True, is_super_admin=False, clear_perms=True):
    async for db in get_db():
        u = await db.get(User, DEV_USER_ID)
        u.is_admin = is_admin
        u.is_super_admin = is_super_admin
        if clear_perms:
            await db.execute(
                delete(AdminPermission).where(AdminPermission.user_id == u.id)
            )
        await db.commit()
        break


async def _grant_dev(module, expires_at=None):
    """直接给 dev 用户插入一条模块授权记录（用于绕过超管 API 快速造受限子管理员）。"""
    async for db in get_db():
        db.add(
            AdminPermission(
                user_id=DEV_USER_ID,
                module=module,
                created_by=DEV_USER_ID,
                expires_at=expires_at,
            )
        )
        await db.commit()
        break


# ── 模块与权限列表 ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_list_modules_catalog(client: AsyncClient, auth_headers: dict):
    """管理员可读取可授予模块清单。"""
    await _set_admin(is_admin=True)
    try:
        resp = await client.get("/api/v1/admin/modules", headers=auth_headers)
        assert resp.status_code == 200
        modules = {i["module"] for i in resp.json()["data"]["items"]}
        assert "users" in modules and "orders" in modules
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_list_permissions_requires_super_admin(client: AsyncClient, auth_headers: dict):
    """仅超管可列出全部管理员授权；普通管理员被拒。"""
    await _set_admin(is_admin=True, is_super_admin=False)
    try:
        resp = await client.get("/api/v1/admin/permissions", headers=auth_headers)
        assert resp.status_code == 403
    finally:
        await _set_admin(is_admin=False)

    await _set_admin(is_admin=True, is_super_admin=True)
    try:
        resp = await client.get("/api/v1/admin/permissions", headers=auth_headers)
        assert resp.status_code == 200
        assert "items" in resp.json()["data"]
    finally:
        await _set_admin(is_admin=False)


# ── 授权（含日期/天数校验）──────────────────────────────────────────


@pytest.mark.anyio
async def test_grant_permission_activates_admin(client: AsyncClient, auth_headers: dict):
    """超管为普通用户授予模块：用户成为子管理员且有授权记录。"""
    await _set_admin(is_admin=True, is_super_admin=True)
    try:
        # 先造一个普通用户
        target_email = f"grant-test-{uuid.uuid4().hex[:8]}@example.com"
        async for db in get_db():
            target = User(email=target_email, nickname="被授权者")
            db.add(target)
            await db.commit()
            target_id = str(target.id)
            break
        resp = await client.post(
            "/api/v1/admin/permissions",
            headers=auth_headers,
            json={"user_id": target_id, "module": "orders", "days": 30},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["is_admin"] is True
        assert data["modules"][0]["module"] == "orders"
        assert data["modules"][0]["expires_at"] is not None
        # 目标用户确实成为管理员
        async for db in get_db():
            t = await db.get(User, uuid.UUID(target_id))
            assert t.is_admin is True
            break
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_grant_permission_with_future_expires_at(client: AsyncClient, auth_headers: dict):
    """以具体到期日期（未来）授权成功。"""
    await _set_admin(is_admin=True, is_super_admin=True)
    try:
        target_email = f"grant-date-{uuid.uuid4().hex[:8]}@e.com"
        async for db in get_db():
            t = User(email=target_email)
            db.add(t)
            await db.commit()
            target_id = str(t.id)
            break
        future = datetime.now(timezone.utc) + timedelta(days=2)
        resp = await client.post(
            "/api/v1/admin/permissions",
            headers=auth_headers,
            json={"user_id": target_id, "module": "users", "expires_at": future.isoformat()},
        )
        assert resp.status_code == 200, resp.text
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_grant_permission_rejects_past_expires_at(client: AsyncClient, auth_headers: dict):
    """过去/今天的到期日期必须被拒绝。"""
    await _set_admin(is_admin=True, is_super_admin=True)
    try:
        target_email = f"grant-past-{uuid.uuid4().hex[:8]}@example.com"
        async for db in get_db():
            t = User(email=target_email)
            db.add(t)
            await db.commit()
            target_id = str(t.id)
            break
        past = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        resp = await client.post(
            "/api/v1/admin/permissions",
            headers=auth_headers,
            json={"user_id": target_id, "module": "users", "expires_at": past.isoformat()},
        )
        assert resp.status_code == 400
        assert "晚于当前时间" in resp.json()["message"]
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_grant_permission_rejects_invalid_days(client: AsyncClient, auth_headers: dict):
    """天数为 0 / 负 → 拒绝。"""
    await _set_admin(is_admin=True, is_super_admin=True)
    try:
        target_email = f"grant-days-{uuid.uuid4().hex[:8]}@example.com"
        async for db in get_db():
            u = User(email=target_email)
            db.add(u)
            await db.commit()
            target_id = str(u.id)
            break
        resp = await client.post(
            "/api/v1/admin/permissions",
            headers=auth_headers,
            json={"user_id": target_id, "module": "users", "days": 0},
        )
        assert resp.status_code in (400, 422)
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_grant_permission_rejects_unknown_module(client: AsyncClient, auth_headers: dict):
    await _set_admin(is_admin=True, is_super_admin=True)
    try:
        target_email = f"grant-unknown-{uuid.uuid4().hex[:8]}@example.com"
        async for db in get_db():
            u = User(email=target_email)
            db.add(u)
            await db.commit()
            target_id = str(u.id)
            break
        resp = await client.post(
            "/api/v1/admin/permissions",
            headers=auth_headers,
            json={"user_id": target_id, "module": "no_such_module", "days": 30},
        )
        assert resp.status_code == 400
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_grant_permission_requires_super_admin(client: AsyncClient, auth_headers: dict):
    """非超管管理员不能授权他人。"""
    await _set_admin(is_admin=True, is_super_admin=False)
    try:
        resp = await client.post(
            "/api/v1/admin/permissions",
            headers=auth_headers,
            json={"user_id": str(DEV_USER_ID), "module": "users", "days": 30},
        )
        assert resp.status_code == 403
    finally:
        await _set_admin(is_admin=False)


# ── 撤销 / 更新 / 移除 ───────────────────────────────────────────────


@pytest.mark.anyio
async def test_revoke_module_when_last_turns_to_normal_user(client: AsyncClient, auth_headers: dict):
    """撤销最后一个模块后，账号退回普通用户。"""
    await _set_admin(is_admin=True, is_super_admin=True)
    try:
        t_email = f"revoke-{uuid.uuid4().hex[:8]}@example.com"
        async for db in get_db():
            t = User(email=t_email)
            db.add(t)
            await db.commit()
            target_id = str(t.id)
            # 直接给目标一条授权，模拟子管理员
            db.add(AdminPermission(user_id=t.id, module="messages", created_by=DEV_USER_ID))
            t.is_admin = True
            await db.commit()
            break
        resp = await client.delete(
            f"/api/v1/admin/permissions/{target_id}/messages",
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["revoked"] is True
        async for db in get_db():
            t = await db.get(User, uuid.UUID(target_id))
            assert t.is_admin is False  # 无剩余授权 → 退回普通用户
            break
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_update_permission_expiry(client: AsyncClient, auth_headers: dict):
    await _set_admin(is_admin=True, is_super_admin=True)
    try:
        await _grant_dev("users")
        future = datetime.now(timezone.utc) + timedelta(days=7)
        resp = await client.patch(
            f"/api/v1/admin/permissions/{DEV_USER_ID}/users",
            headers=auth_headers,
            json={"expires_at": future.isoformat()},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["expires_at"] is not None
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_remove_admin_removes_all_grants(client: AsyncClient, auth_headers: dict):
    await _set_admin(is_admin=True, is_super_admin=True)
    try:
        t_email = f"remove-{uuid.uuid4().hex[:8]}@example.com"
        async for db in get_db():
            t = User(email=t_email)
            db.add(t)
            await db.commit()
            target_id = str(t.id)
            for m in ("users", "orders"):
                db.add(AdminPermission(user_id=t.id, module=m, created_by=DEV_USER_ID))
            t.is_admin = True
            await db.commit()
            break
        resp = await client.delete(
            f"/api/v1/admin/permissions/user/{target_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["removed"] is True
        async for db in get_db():
            t = await db.get(User, uuid.UUID(target_id))
            assert t.is_admin is False
            remains = (
                await db.execute(
                    select(AdminPermission).where(AdminPermission.user_id == uuid.UUID(target_id))
                )
            ).scalars().all()
            assert len(remains) == 0  # 已清空
            break
    finally:
        await _set_admin(is_admin=False)


# ── 模块访问控制 ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_restricted_sub_admin_cannot_access_other_module(client: AsyncClient, auth_headers: dict):
    """受限子管理员（仅授予 orders）访问 users 被拒，访问 orders 通过。"""
    await _set_admin(is_admin=True, is_super_admin=False, clear_perms=True)
    await _grant_dev("orders")
    try:
        resp_users = await client.get("/api/v1/admin/users", headers=auth_headers)
        assert resp_users.status_code == 403
        resp_orders = await client.get("/api/v1/admin/orders", headers=auth_headers)
        assert resp_orders.status_code == 200
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_legacy_admin_without_grants_has_full_access(client: AsyncClient, auth_headers: dict):
    """历史管理员（is_admin=True 但无授权记录）仍拥有全部模块。"""
    await _set_admin(is_admin=True, is_super_admin=False, clear_perms=True)
    try:
        resp = await client.get("/api/v1/admin/users", headers=auth_headers)
        assert resp.status_code == 200
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_expired_permission_denied(client: AsyncClient, auth_headers: dict):
    """授权已过期的子管理员不能访问该模块。"""
    await _set_admin(is_admin=True, is_super_admin=False, clear_perms=True)
    past = datetime.now(timezone.utc) - timedelta(days=1)
    await _grant_dev("users", expires_at=past)
    try:
        resp = await client.get("/api/v1/admin/users", headers=auth_headers)
        assert resp.status_code == 403
    finally:
        await _set_admin(is_admin=False)


# ── 套餐到期时间校验（F-ADM-006）── ───────────────────────────────────


@pytest.mark.anyio
async def test_change_plan_rejects_past_expiry(client: AsyncClient, auth_headers: dict):
    """changePlan 的 expires_at 必须是未来；过去/今天被拒。"""
    await _set_admin(is_admin=True)
    try:
        target_email = f"plan-{uuid.uuid4().hex[:8]}@example.com"
        async for db in get_db():
            u = User(email=target_email)
            db.add(u)
            await db.commit()
            target_id = str(u.id)
            break
        past = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        resp = await client.patch(
            f"/api/v1/admin/users/{target_id}/plan",
            headers=auth_headers,
            json={"plan": "single", "expires_at": past.isoformat()},
        )
        assert resp.status_code == 400
        assert "晚于当前时间" in resp.json()["message"]
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_offline_open_rejects_past_expires_at(client: AsyncClient, auth_headers: dict):
    """线下开通传入过去的到期日期必须被拒。"""
    await _set_admin(is_admin=True)
    try:
        target_email = f"off-past-{uuid.uuid4().hex[:8]}@example.com"
        async for db in get_db():
            u = User(email=target_email)
            db.add(u)
            await db.commit()
            target_id = str(u.id)
            break
        past = datetime.now(timezone.utc) - timedelta(days=1)
        resp = await client.post(
            "/api/v1/admin/orders",
            headers=auth_headers,
            json={
                "user_id": target_id,
                "plan_type": "single",
                "channel": "xianyu",
                "expires_at": past.isoformat(),
            },
        )
        assert resp.status_code == 400
        assert "晚于当前时间" in resp.json()["message"]
    finally:
        await _set_admin(is_admin=False)


@pytest.mark.anyio
async def test_offline_open_with_future_date_activates_plan(client: AsyncClient, auth_headers: dict):
    """线下开通可直接开到具体未来日期，且用户套餐到期时间随之更新。"""
    await _set_admin(is_admin=True)
    try:
        target_email = f"o-future-{uuid.uuid4().hex[:8]}@example.com"
        async for db in get_db():
            u = User(email=target_email)
            db.add(u)
            await db.commit()
            target_id = str(u.id)
            break
        future = datetime.now(timezone.utc) + timedelta(days=20)
        resp = await client.post(
            "/api/v1/admin/orders",
            headers=auth_headers,
            json={
                "user_id": target_id,
                "plan_type": "single",
                "channel": "wechat",
                "expires_at": future.isoformat(),
            },
        )
        assert resp.status_code == 200, resp.text
        # 验证用户套餐到期时间被设为该未来日期
        async for db in get_db():
            u = await db.get(User, uuid.UUID(target_id))
            assert u.plan == "single"
            assert u.plan_expires_at is not None
            assert u.plan_expires_at > datetime.now(timezone.utc)
            break
    finally:
        await _set_admin(is_admin=False)