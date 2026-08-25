"""留言管理后台（Task 2.4）测试。

覆盖：非管理员 403；管理员可列出全部留言（含他人生成、带联系方式）并按 tag 筛选；
管理员可切换任意留言状态 + 备注（写审计）。均通过 /api/v1/admin/messages 完成。
"""
import uuid

import pytest
from httpx import AsyncClient

from app.core.database import get_db
from app.models.user import User


async def _make_admin():
    async for db in get_db():
        u = await db.get(User, uuid.UUID("00000000-0000-0000-0000-000000000001"))
        u.is_admin = True
        await db.commit()
        break


async def _unmake_admin():
    async for db in get_db():
        u = await db.get(User, uuid.UUID("00000000-0000-0000-0000-000000000001"))
        u.is_admin = False
        await db.commit()
        break


@pytest.mark.anyio
async def test_non_admin_forbidden(client: AsyncClient, auth_headers: dict):
    """非管理员访问留言管理接口返回 403。"""
    resp = await client.get("/api/v1/admin/messages", headers=auth_headers)
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_admin_list_all_with_filters(
    client: AsyncClient, auth_headers: dict
):
    """管理员可列出全部留言（含他人/含联系方式），并按 tag 与状态筛选。"""
    await _make_admin()
    try:
        # 建两条不同 tag 的留言
        r1 = await client.post(
            "/api/v1/messages", headers=auth_headers,
            json={"tag": "incident", "content": "导出失败", "contact": "wx123"},
        )
        r2 = await client.post(
            "/api/v1/messages", headers=auth_headers,
            json={"tag": "feedback", "content": "想改进配色"},
        )
        assert r1.status_code == 200 and r2.status_code == 200
        id1 = r1.json()["data"]["id"]

        lst = await client.get("/api/v1/admin/messages", headers=auth_headers)
        assert lst.status_code == 200
        items = lst.json()["data"]["items"]
        hit = next((i for i in items if i["id"] == id1), None)
        assert hit is not None
        # 带联系方式与用户信息字段，便于一键复制
        assert hit["contact"] == "wx123"
        assert "user_email" in hit
        assert "user_nickname" in hit
        assert hit["tag_label"]

        # 筛选：仅 incident
        filtered = await client.get(
            "/api/v1/admin/messages?tag=incident", headers=auth_headers
        )
        assert filtered.status_code == 200
        f_items = filtered.json()["data"]["items"]
        assert all(i["tag"] == "incident" for i in f_items)

        # 关键词搜索联系方式
        kw = await client.get(
            "/api/v1/admin/messages?keyword=wx123", headers=auth_headers
        )
        assert kw.status_code == 200
        assert len(kw.json()["data"]["items"]) >= 1
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_admin_update_any_status_with_remark(
    client: AsyncClient, auth_headers: dict
):
    """管理员可把任意留言置为处理中/已处理并写备注。"""
    await _make_admin()
    try:
        created = (
            await client.post(
                "/api/v1/messages", headers=auth_headers,
                json={"tag": "rescue", "content": "信效度不达标，求助"},
            )
        ).json()["data"]

        resp = await client.patch(
            f"/api/v1/admin/messages/{created['id']}/status",
            headers=auth_headers,
            json={"status": "processing", "handle_remark": "已加微信联系"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "processing"
        assert data["handle_remark"] == "已加微信联系"
        assert data["handled_by"] is not None
    finally:
        await _unmake_admin()