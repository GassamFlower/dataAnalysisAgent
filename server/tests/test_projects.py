"""项目 CRUD 测试（Round 1 验收）。

覆盖：
- 创建项目
- 列表分页（含 page_size 上限）
- 项目详情
- 重命名
- 软删除（删除后不可访问、不在列表）
- 未找到 / 未认证
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.exceptions import ValidationException
from app.models.project import Project
from app.services.project_service import can_transition, update_project_status


@pytest.fixture(autouse=True)
def ensure_jwt_secret():
    """确保测试环境有 JWT 密钥。"""
    if not settings.JWT_SECRET_KEY:
        settings.JWT_SECRET_KEY = "test-jwt-secret-do-not-use-in-production"


@pytest.fixture
async def auth_headers(client: AsyncClient):
    """通过 dev-login 获取测试用户 token。"""
    resp = await client.post("/api/v1/auth/dev-login")
    assert resp.status_code == 200
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def created_project(client: AsyncClient, auth_headers: dict):
    """创建一个测试项目并返回其 id。"""
    resp = await client.post(
        "/api/v1/projects/",
        headers=auth_headers,
        json={"name": "测试项目"},
    )
    assert resp.status_code == 201
    return resp.json()["data"]


@pytest.mark.anyio
async def test_create_project(client: AsyncClient, auth_headers: dict):
    """创建项目成功后返回 draft 状态。"""
    resp = await client.post(
        "/api/v1/projects/",
        headers=auth_headers,
        json={"name": "大学生学习动机研究"},
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["name"] == "大学生学习动机研究"
    assert data["status"] == "draft"
    assert "id" in data


@pytest.mark.anyio
async def test_list_projects_pagination(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
):
    """列表分页返回 total/items/page/page_size，page_size 超过上限按 100 处理。"""
    # 再创建两个项目，确保分页生效
    for i in range(2):
        resp = await client.post(
            "/api/v1/projects/",
            headers=auth_headers,
            json={"name": f"分页项目 {i}"},
        )
        assert resp.status_code == 201

    resp = await client.get(
        "/api/v1/projects/?page=1&page_size=2",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "items" in data
    assert "total" in data
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert len(data["items"]) == 2
    assert data["total"] >= 3

    # page_size 上限
    resp_large = await client.get(
        "/api/v1/projects/?page=1&page_size=200",
        headers=auth_headers,
    )
    assert resp_large.status_code == 200
    assert resp_large.json()["data"]["page_size"] == 100


@pytest.mark.anyio
async def test_get_project(client: AsyncClient, auth_headers: dict, created_project: dict):
    """可获取刚创建的项目详情。"""
    resp = await client.get(
        f"/api/v1/projects/{created_project['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == created_project["id"]
    assert data["name"] == created_project["name"]


@pytest.mark.anyio
async def test_update_project_name(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
):
    """PATCH 可重命名项目。"""
    resp = await client.patch(
        f"/api/v1/projects/{created_project['id']}",
        headers=auth_headers,
        json={"name": "已重命名项目"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "已重命名项目"

    # 再次获取确认持久化
    get_resp = await client.get(
        f"/api/v1/projects/{created_project['id']}",
        headers=auth_headers,
    )
    assert get_resp.json()["data"]["name"] == "已重命名项目"


@pytest.mark.anyio
async def test_delete_project_soft(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
):
    """删除为软删除：GET 返回 404，列表不包含。"""
    project_id = created_project["id"]

    delete_resp = await client.delete(
        f"/api/v1/projects/{project_id}",
        headers=auth_headers,
    )
    assert delete_resp.status_code == 204

    get_resp = await client.get(
        f"/api/v1/projects/{project_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404

    list_resp = await client.get(
        "/api/v1/projects/?page=1&page_size=100",
        headers=auth_headers,
    )
    items = list_resp.json()["data"]["items"]
    assert not any(p["id"] == project_id for p in items)


@pytest.mark.anyio
async def test_get_project_not_found(client: AsyncClient, auth_headers: dict):
    """访问不存在的项目返回 404。"""
    resp = await client.get(
        f"/api/v1/projects/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_unauthorized(client: AsyncClient):
    """未携带 token 访问项目接口返回 401。"""
    resp = await client.get("/api/v1/projects/")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_invalid_pagination_params(client: AsyncClient, auth_headers: dict):
    """非法分页参数返回 400。"""
    resp = await client.get(
        "/api/v1/projects/?page=0&page_size=10",
        headers=auth_headers,
    )
    assert resp.status_code == 400

    resp2 = await client.get(
        "/api/v1/projects/?page=1&page_size=0",
        headers=auth_headers,
    )
    assert resp2.status_code == 400


@pytest.mark.anyio
async def test_project_status_transition_rules():
    """状态按 draft → inspected → hypothesized → simulated → analyzed 单向流转。"""
    project = Project(name="状态测试", user_id=uuid.uuid4(), status="draft")
    assert project.status == "draft"

    transitions = ["inspected", "hypothesized", "simulated", "analyzed"]
    for target in transitions:
        assert can_transition(project.status, target) is True
        update_project_status(project, target)
        assert project.status == target


@pytest.mark.anyio
async def test_project_status_same_no_op():
    """目标状态与当前状态一致时不报错，仅刷新 updated_at。"""
    project = Project(name="状态测试", user_id=uuid.uuid4(), status="draft")
    before = datetime.now(timezone.utc)
    update_project_status(project, "draft")
    assert project.status == "draft"
    assert project.updated_at >= before


@pytest.mark.anyio
async def test_project_status_illegal_transition():
    """非法状态流转（如 analyzed → draft）抛出 ValidationException。"""
    project = Project(name="状态测试", user_id=uuid.uuid4(), status="analyzed")

    assert can_transition("analyzed", "draft") is False
    with pytest.raises(ValidationException):
        update_project_status(project, "draft")

    # 跳跃同样非法
    project2 = Project(name="状态测试", user_id=uuid.uuid4(), status="draft")
    assert can_transition("draft", "simulated") is False
    with pytest.raises(ValidationException):
        update_project_status(project2, "simulated")
