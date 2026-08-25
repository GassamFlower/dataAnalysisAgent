"""留言（Task 2.1）测试。

覆盖：建 / 查（列表+筛选+详情）/ 删 / 标记处理（本人关闭 + 管理员处理并写审计）。
验收：建、查、处理 3 接口通过；五类 tag + project_id + 数据源落库。
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import get_db
from app.models.audit_logs import AuditLog
from app.models.user import User


def _create_message(
    client: AsyncClient,
    auth_headers: dict,
    tag="feedback",
    content="留言内容",
    **extra,
):
    body = {"tag": tag, "content": content, **extra}
    return client.post("/api/v1/messages", headers=auth_headers, json=body)


@pytest.mark.anyio
async def test_create_and_list_message(auth_headers: dict, client: AsyncClient):
    """建留言并能在列表中查到，字段与中文标签正确落库。"""
    resp = await _create_message(client, auth_headers, tag="feedback", content="想提个产品建议")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["tag"] == "feedback"
    assert data["tag_label"] == "产品建议"
    assert data["status"] == "pending"
    assert data["status_label"] == "待处理"
    assert data["content"] == "想提个产品建议"

    lst = await client.get("/api/v1/messages", headers=auth_headers)
    assert lst.status_code == 200
    items = lst.json()["data"]["items"]
    assert any(item["id"] == data["id"] for item in items)


@pytest.mark.anyio
async def test_create_binds_project_and_data_source(
    auth_headers: dict,
    created_project: dict,
    client: AsyncClient,
):
    """留言关联 project_id + 数据源（real/simulation）落库。"""
    resp = await _create_message(
        client,
        auth_headers,
        tag="rescue",
        project_id=created_project["id"],
        data_source="simulation",
        contact="user@example.com",
        entry_point="report-rescue",
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["project_id"] == created_project["id"]
    assert data["data_source"] == "simulation"
    assert data["data_source_label"] == "模拟数据"
    assert data["contact"] == "user@example.com"
    assert data["entry_point"] == "report-rescue"


@pytest.mark.anyio
async def test_create_rejects_foreign_project(auth_headers: dict, client: AsyncClient):
    """不能把留言挂靠在他人/不存在的项目上。"""
    foreign = str(uuid.uuid4())
    resp = await _create_message(client, auth_headers, project_id=foreign)
    assert resp.status_code == 400


@pytest.mark.anyio
async def test_create_rejects_invalid_tag(auth_headers: dict, client: AsyncClient):
    """非法 tag / data_source 被拒，五类 tag 之外不可落库。"""
    assert (await _create_message(client, auth_headers, tag="未知分类")).status_code == 400
    assert (
        await _create_message(client, auth_headers, tag="feedback", data_source="weird")
    ).status_code == 400
    assert (
        await _create_message(client, auth_headers, tag="bad")
    ).status_code == 400


@pytest.mark.anyio
async def test_list_filter_by_tag(auth_headers: dict, client: AsyncClient):
    """按五类 tag 筛选。"""
    await _create_message(client, auth_headers, tag="incident")
    await _create_message(client, auth_headers, tag="service")
    resp = await client.get(
        "/api/v1/messages?tag=incident", headers=auth_headers
    )
    items = resp.json()["data"]["items"]
    assert items and all(item["tag"] == "incident" for item in items)


@pytest.mark.anyio
async def test_owner_can_close_own_message(auth_headers: dict, client: AsyncClient):
    """本人可关闭自己的留言为 done；不可越权改成其他状态。"""
    created = (await _create_message(client, auth_headers)).json()["data"]
    resp = await client.patch(
        f"/api/v1/messages/{created['id']}/status",
        headers=auth_headers,
        json={"status": "done"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "done"

    # 非管理员不能改成 processing
    resp2 = await client.patch(
        f"/api/v1/messages/{created['id']}/status",
        headers=auth_headers,
        json={"status": "processing"},
    )
    assert resp2.status_code == 403


@pytest.mark.anyio
async def test_admin_mark_message_writes_audit(auth_headers: dict, client: AsyncClient):
    """管理员可切换任意状态 + 备注，并写入审计日志衔接留痕。"""
    # 将 dev 用户临时置为管理员（get_current_user 每次读库，无需重新登录）
    async for db in get_db():
        u = await db.get(User, uuid.UUID("00000000-0000-0000-0000-000000000001"))
        u.is_admin = True
        await db.commit()
        break
    try:
        created = (await _create_message(client, auth_headers, tag="rescue")).json()["data"]
        resp = await client.patch(
            f"/api/v1/messages/{created['id']}/status",
            headers=auth_headers,
            json={"status": "processing", "handle_remark": "已转人工分析"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "processing"
        assert data["handle_remark"] == "已转人工分析"
        assert data["handled_by"] is not None

        async for db in get_db():
            log = (
                await db.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.action_type == "admin_mark_message",
                        AuditLog.user_id == uuid.UUID(
                            "00000000-0000-0000-0000-000000000001"
                        ),
                    )
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert log is not None
            assert log.action_detail.get("message_id") == created["id"]
            break
    finally:
        async for db in get_db():
            u = await db.get(User, uuid.UUID("00000000-0000-0000-0000-000000000001"))
            u.is_admin = False
            await db.commit()
            break


@pytest.mark.anyio
async def test_owner_delete_message(auth_headers: dict, client: AsyncClient):
    """本人可删除留言（软删），删除后列表与详情不可见。"""
    created = (await _create_message(client, auth_headers)).json()["data"]
    d = await client.delete(
        f"/api/v1/messages/{created['id']}", headers=auth_headers
    )
    assert d.status_code == 200

    detail = await client.get(
        f"/api/v1/messages/{created['id']}", headers=auth_headers
    )
    assert detail.status_code == 404
    lst = await client.get("/api/v1/messages", headers=auth_headers)
    assert all(item["id"] != created["id"] for item in lst.json()["data"]["items"])