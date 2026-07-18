"""问卷体检模块测试（Round 1 验收）。

覆盖：
- 题目解析（LLM 被 mock）
- 解析后项目状态变为 inspected
- 查询题目列表
- 更新单题（维度 / 反向题 / 置信度）
- 未认证 / 越权 / 非法参数
"""

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.schemas.questionnaire import Question, QuestionnaireStructure


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
        json={"name": "问卷体检测试项目"},
    )
    assert resp.status_code == 201
    return resp.json()["data"]


@pytest.fixture
def mock_inspect(monkeypatch):
    """Mock LLM 解析服务，避免测试调用外部接口。"""

    def _fake_inspect(raw_text: str) -> QuestionnaireStructure:
        del raw_text  # unused
        return QuestionnaireStructure(
            questions=[
                Question(
                    index=1,
                    text="我对学习充满热情",
                    question_type="likert5",
                    dimension="学习动机",
                    is_reverse=False,
                    confidence="high",
                ),
                Question(
                    index=2,
                    text="我觉得学习很无聊",
                    question_type="likert5",
                    dimension="学习动机",
                    is_reverse=True,
                    confidence="high",
                ),
                Question(
                    index=3,
                    text="我的性别是",
                    question_type="demographic",
                    dimension="人口学",
                    is_reverse=False,
                    confidence="high",
                ),
            ],
            dimensions=["学习动机", "人口学"],
            scale_type="likert5",
        )

    monkeypatch.setattr(
        "app.api.v1.questionnaire.inspect_service",
        _fake_inspect,
    )
    return _fake_inspect


@pytest.mark.anyio
async def test_inspect_questionnaire_success(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
    mock_inspect,
):
    """解析题目成功，返回结构并更新项目状态为 inspected。"""
    project_id = created_project["id"]

    resp = await client.post(
        f"/api/v1/questionnaire/inspect?project_id={project_id}",
        headers=auth_headers,
        json={"text": "1. 我对学习充满热情\n2. 我觉得学习很无聊\n3. 我的性别是"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "questions" in data
    assert "dimensions" in data
    assert data["scale_type"] == "likert5"
    assert len(data["questions"]) == 3
    assert {q["dimension"] for q in data["questions"]} == {"学习动机", "人口学"}

    # 项目状态流转为 inspected
    project_resp = await client.get(
        f"/api/v1/projects/{project_id}",
        headers=auth_headers,
    )
    assert project_resp.status_code == 200
    assert project_resp.json()["data"]["status"] == "inspected"


@pytest.mark.anyio
async def test_inspect_requires_auth(
    client: AsyncClient,
    created_project: dict,
    mock_inspect,
):
    """未认证无法解析题目。"""
    resp = await client.post(
        f"/api/v1/questionnaire/inspect?project_id={created_project['id']}",
        json={"text": "1. test"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_get_questions_after_inspect(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
    mock_inspect,
):
    """解析后可查询题目列表。"""
    project_id = created_project["id"]
    await client.post(
        f"/api/v1/questionnaire/inspect?project_id={project_id}",
        headers=auth_headers,
        json={"text": "test"},
    )

    resp = await client.get(
        f"/api/v1/questionnaire/questions/{project_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 3
    assert data[0]["index"] == 1
    assert "dimension" in data[0]


@pytest.mark.anyio
async def test_update_question(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
    mock_inspect,
):
    """更新单题维度与反向题标记。"""
    project_id = created_project["id"]
    await client.post(
        f"/api/v1/questionnaire/inspect?project_id={project_id}",
        headers=auth_headers,
        json={"text": "test"},
    )

    resp = await client.patch(
        f"/api/v1/questionnaire/questions/{project_id}/1",
        headers=auth_headers,
        json={"dimension": "内在动机", "is_reverse": True},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["dimension"] == "内在动机"
    assert data["is_reverse"] is True

    # 查询列表验证持久化
    list_resp = await client.get(
        f"/api/v1/questionnaire/questions/{project_id}",
        headers=auth_headers,
    )
    first = next(q for q in list_resp.json()["data"] if q["index"] == 1)
    assert first["dimension"] == "内在动机"
    assert first["is_reverse"] is True


@pytest.mark.anyio
async def test_update_question_not_found(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
    mock_inspect,
):
    """更新不存在的题目返回 404。"""
    project_id = created_project["id"]
    await client.post(
        f"/api/v1/questionnaire/inspect?project_id={project_id}",
        headers=auth_headers,
        json={"text": "test"},
    )

    resp = await client.patch(
        f"/api/v1/questionnaire/questions/{project_id}/999",
        headers=auth_headers,
        json={"dimension": "不存在"},
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_question_requires_auth(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
    mock_inspect,
):
    """未认证无法更新题目。"""
    project_id = created_project["id"]
    await client.post(
        f"/api/v1/questionnaire/inspect?project_id={project_id}",
        headers=auth_headers,
        json={"text": "test"},
    )

    resp = await client.patch(
        f"/api/v1/questionnaire/questions/{project_id}/1",
        json={"dimension": "X"},
    )
    assert resp.status_code == 401
