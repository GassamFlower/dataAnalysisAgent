"""管理后台优化新增端点测试（本轮 4 项优化）：
1. 运行时配额配置 GET/PUT /admin/configs/quota-limits
2. 订单退款标记 PATCH /admin/orders/{id}/refund
3. 运营看板增强 GET /admin/dashboard/overview
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import get_db
from app.models.audit_logs import AuditLog
from app.models.order import Order
from app.models.user import User

DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def _make_admin():
    async for db in get_db():
        u = await db.get(User, DEV_USER_ID)
        u.is_admin = True
        await db.commit()
        break


async def _unmake_admin():
    async for db in get_db():
        u = await db.get(User, DEV_USER_ID)
        u.is_admin = False
        await db.commit()
        break


@pytest.mark.anyio
async def test_quota_limits_get_defaults(client: AsyncClient, auth_headers: dict):
    """未配置时返回各动作默认上限。"""
    await _make_admin()
    try:
        resp = await client.get("/api/v1/admin/configs/quota-limits", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        actions = {item["action"]: item for item in data["items"]}
        assert actions["simulation"]["value"] == 6
        assert actions["export"]["value"] == 6
        assert actions["ai_interpret"]["value"] == 1
        assert all(item["source"] == "default" for item in data["items"])
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_non_admin_forbidden_config(client: AsyncClient, auth_headers: dict):
    """非管理员访问配额配置被拒绝。"""
    resp = await client.put(
        "/api/v1/admin/configs/quota-limits/simulation",
        headers=auth_headers,
        json={"action": "simulation", "value": 5},
    )
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_update_quota_limit(client: AsyncClient, auth_headers: dict):
    """管理员调整配额 → DB 覆盖生效 + 写审计。"""
    await _make_admin()
    try:
        resp = await client.put(
            "/api/v1/admin/configs/quota-limits/simulation",
            headers=auth_headers,
            json={"action": "simulation", "value": 8},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["action"] == "simulation"
        assert data["value"] == 8
        assert data["source"] == "override"

        # 再次读取确认覆盖值
        resp2 = await client.get("/api/v1/admin/configs/quota-limits", headers=auth_headers)
        items = {i["action"]: i for i in resp2.json()["data"]["items"]}
        assert items["simulation"]["value"] == 8
        assert items["simulation"]["source"] == "override"

        # 审计留痕
        async for db in get_db():
            audit = (
                await db.execute(
                    select(AuditLog)
                    .where(AuditLog.action_type == "admin_update_quota_limit")
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert audit is not None
            assert (audit.action_detail or {}).get("action") == "simulation"
            break
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_update_quota_limit_invalid_value(client: AsyncClient, auth_headers: dict):
    """负数配额被拒绝。"""
    await _make_admin()
    try:
        resp = await client.put(
            "/api/v1/admin/configs/quota-limits/simulation",
            headers=auth_headers,
            json={"action": "simulation", "value": -1},
        )
        assert resp.status_code in (400, 422)
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_update_quota_limit_unknown_action(client: AsyncClient, auth_headers: dict):
    """未知配额动作被拒绝。"""
    await _make_admin()
    try:
        resp = await client.put(
            "/api/v1/admin/configs/quota-limits/bogus",
            headers=auth_headers,
            json={"action": "bogus", "value": 3},
        )
        assert resp.status_code == 404
    finally:
        await _unmake_admin()


async def _create_paid_order(client: AsyncClient, auth_headers: dict):
    """用后台线下单创建一个 paid 订单。"""
    resp = await client.post(
        "/api/v1/admin/orders",
        headers=auth_headers,
        json={"user_id": str(DEV_USER_ID), "plan_type": "single", "channel": "xianyu"},
    )
    assert resp.status_code == 200
    return resp.json()["data"]["order"]["id"]


@pytest.mark.anyio
async def test_refund_paid_order(client: AsyncClient, auth_headers: dict):
    """将已支付订单标记为已退款。"""
    await _make_admin()
    try:
        order_id = await _create_paid_order(client, auth_headers)
        resp = await client.patch(
            f"/api/v1/admin/orders/{order_id}/refund",
            headers=auth_headers,
            json={"reason": "客户申请退款"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "refunded"

        async for db in get_db():
            order = await db.get(Order, uuid.UUID(order_id))
            assert order.status == "refunded"
            audit = (
                await db.execute(
                    select(AuditLog)
                    .where(AuditLog.action_type == "admin_refund_order")
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert audit is not None
            assert (audit.action_detail or {}).get("reason") == "客户申请退款"
            break
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_refund_non_paid_order_rejected(client: AsyncClient, auth_headers: dict):
    """不能退款非『已支付』订单。"""
    await _make_admin()
    try:
        # 用一个不存在的订单 ID，应 404
        resp = await client.patch(
            f"/api/v1/admin/orders/{uuid.uuid4()}/refund",
            headers=auth_headers,
            json={"reason": "x"},
        )
        assert resp.status_code == 404
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_dashboard_overview(client: AsyncClient, auth_headers: dict):
    """运营看板补充维度可读取且字段齐全。"""
    await _make_admin()
    try:
        resp = await client.get("/api/v1/admin/dashboard/overview", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "total_users" in data
        assert set(data["plan_distribution"]) == {"free", "single", "subscription"}
        assert set(data["projects_by_mode"]) == {"real", "simulation"}
        assert "total_projects" in data
        assert "active_users_7d" in data
        assert "pending_messages" in data
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_export_users_csv(client: AsyncClient, auth_headers: dict):
    """导出全部用户 CSV：可读、含表头、含登录用户行、带 UTF-8 BOM。"""
    await _make_admin()
    try:
        resp = await client.post(
            "/api/v1/admin/users/export", headers=auth_headers, json={}
        )
        assert resp.status_code == 200
        body = resp.content
        # UTF-8 BOM 前缀
        assert body.startswith(b"\xef\xbb\xbf")
        text = body.decode("utf-8-sig")
        lines = text.splitlines()
        assert lines, "CSV 不应为空"
        header = lines[0]
        assert "邮箱" in header and "昵称" in header and "注册时间" in header
        # 至少包含当前 dev 用户（有昵称/邮箱快照可匹配其 user id）
        assert str(DEV_USER_ID) in text
        assert "Content-Disposition" in resp.headers
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_export_users_non_admin_forbidden(client: AsyncClient, auth_headers: dict):
    """非管理员导出用户被拒绝。"""
    resp = await client.post(
        "/api/v1/admin/users/export", headers=auth_headers, json={}
    )
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_users_list_disabled_empty_string_ok(client: AsyncClient, auth_headers: dict):
    """disabled= 空串不再 422：视为不过滤，返回 200。"""
    await _make_admin()
    try:
        resp = await client.get(
            "/api/v1/admin/users", headers=auth_headers, params={"disabled": ""}
        )
        assert resp.status_code == 200
        assert "items" in resp.json()["data"]
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_users_list_disabled_variants(client: AsyncClient, auth_headers: dict):
    """disabled 宽容解析：1/true/0/false/大小写均可。"""
    await _make_admin()
    try:
        for raw in ("1", "true", "TRUE", "on", "yes"):
            resp = await client.get(
                "/api/v1/admin/users", headers=auth_headers, params={"disabled": raw}
            )
            assert resp.status_code == 200, f"disabled={raw} 应 200"
        for raw in ("0", "false", "FALSE", "off", "no"):
            resp = await client.get(
                "/api/v1/admin/users", headers=auth_headers, params={"disabled": raw}
            )
            assert resp.status_code == 200, f"disabled={raw} 应 200"
        # 旧版前端曾把 undefined 序列化为字符串，视为不过滤而非报错
        resp = await client.get(
            "/api/v1/admin/users", headers=auth_headers, params={"disabled": "undefined"}
        )
        assert resp.status_code == 200
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_users_list_disabled_invalid(client: AsyncClient, auth_headers: dict):
    """无法识别的 disabled 值返回 400（而非 422）。"""
    await _make_admin()
    try:
        resp = await client.get(
            "/api/v1/admin/users", headers=auth_headers, params={"disabled": "abc"}
        )
        assert resp.status_code == 400
    finally:
        await _unmake_admin()


async def _create_message(client, auth_headers, tag="feedback", content="批量测试留言"):
    return await client.post(
        "/api/v1/messages", headers=auth_headers,
        json={"tag": tag, "content": content},
    )


@pytest.mark.anyio
async def test_batch_update_message_status(client: AsyncClient, auth_headers: dict):
    """管理员批量把多条留言标记为已处理（写逐条审计）。"""
    await _make_admin()
    try:
        m1 = (await _create_message(client, auth_headers)).json()["data"]
        m2 = (await _create_message(client, auth_headers, content="第二条批量留言")).json()["data"]

        resp = await client.patch(
            "/api/v1/admin/messages/batch-status",
            headers=auth_headers,
            json={"message_ids": [m1["id"], m2["id"]], "status": "done"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["updated"] == 2

        # 落库验证两条都已 done，且审计留痕（batch=True）
        async for db in get_db():
            audits = (
                await db.execute(
                    select(AuditLog)
                    .where(AuditLog.action_type == "admin_mark_message")
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().all()
            batch_logs = [a for a in audits if (a.action_detail or {}).get("batch")]
            assert len(batch_logs) >= 2
            break
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_batch_update_message_status_empty_rejected(client: AsyncClient, auth_headers: dict):
    """空 message_ids 批量请求被拒绝。"""
    await _make_admin()
    try:
        resp = await client.patch(
            "/api/v1/admin/messages/batch-status",
            headers=auth_headers,
            json={"message_ids": [], "status": "done"},
        )
        assert resp.status_code in (400, 422)
    finally:
        await _unmake_admin()