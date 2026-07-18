"""pytest 配置与通用测试 fixture。"""
import uuid

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models.dataset import Dataset
from app.models.project import Project
from app.models.question import Question
from app.models.simulation_config import SimulationConfig
from app.models.user import User


DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
async def client():
    """异步测试客户端。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def anyio_backend():
    """使用 asyncio 作为 anyio 后端。"""
    return "asyncio"


@pytest.fixture(autouse=True)
def ensure_test_settings():
    """确保测试环境启用开发模式与 JWT 密钥。

    避免 config.py 的安全默认值（DEBUG=False / ALLOW_DEV_TOKEN=False）
    导致依赖 dev-login 的测试失败。
    """
    settings.DEBUG = True
    settings.ALLOW_DEV_TOKEN = True
    settings.DEV_TOKEN = "dev-token"
    if not settings.JWT_SECRET_KEY:
        settings.JWT_SECRET_KEY = "test-jwt-secret-do-not-use-in-production"
    if not settings.RESET_JWT_SECRET_KEY:
        settings.RESET_JWT_SECRET_KEY = "test-reset-jwt-secret-do-not-use-in-production"


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


@pytest.fixture
async def simulated_project(client: AsyncClient, auth_headers: dict, created_project: dict):
    """创建已生成数据、状态为 simulated 的项目，并返回项目 id。"""
    project_id = uuid.UUID(created_project["id"])

    async for db in get_db():
        # 1. 插入题目（3 题同维度，保证 α 可计算）
        for i in range(1, 4):
            db.add(
                Question(
                    project_id=project_id,
                    index=i,
                    text=f"学习动机题 {i}",
                    question_type="likert5",
                    dimension="学习动机",
                    is_reverse=False,
                    confidence="high",
                )
            )

        # 2. 插入模拟配置
        sim_config = SimulationConfig(
            project_id=project_id,
            sample_size=100,
        )
        db.add(sim_config)
        await db.flush()

        # 3. 插入维度级数据集
        base_values = [3 + (i % 3) for i in range(100)]
        dataset = Dataset(
            simulation_config_id=sim_config.id,
            project_id=project_id,
            sample_size=100,
            columns=["学习动机"],
            data=[[v] for v in base_values],
        )
        db.add(dataset)

        # 4. 更新项目状态为 simulated（测试 fixture 直接设置，绕过状态机校验）
        project = await db.get(Project, project_id)
        project.status = "simulated"
        await db.commit()
        break

    return created_project


@pytest.fixture
async def simulated_project_missing_dataset(client: AsyncClient, auth_headers: dict, created_project: dict):
    """状态为 simulated 但没有数据集的项目。"""
    project_id = uuid.UUID(created_project["id"])

    async for db in get_db():
        project = await db.get(Project, project_id)
        project.status = "simulated"
        await db.commit()
        break

    return created_project


async def activate_subscription(client: AsyncClient, auth_headers: dict) -> None:
    """通过 mock 支付把 dev 用户升级到 single 套餐。"""
    order_resp = await client.post(
        "/api/v1/payment/orders",
        headers=auth_headers,
        json={"plan_type": "single"},
    )
    assert order_resp.status_code == 200
    order_id = order_resp.json()["data"]["id"]

    notify_resp = await client.post(
        f"/api/v1/payment/orders/{order_id}/notify",
        headers=auth_headers,
        json={
            "channel": "wechat",
            "transaction_id": f"test-{uuid.uuid4().hex[:8]}",
            "status": "success",
        },
    )
    assert notify_resp.status_code == 200


@pytest.fixture
async def paid_auth_headers(client: AsyncClient, auth_headers: dict):
    """已购买 single 套餐的认证头。"""
    await activate_subscription(client, auth_headers)
    return auth_headers


@pytest.fixture
async def free_auth_headers(client: AsyncClient, auth_headers: dict):
    """确保 dev 用户为 free 套餐的认证头。"""
    async for db in get_db():
        user = await db.get(User, DEV_USER_ID)
        user.plan = "free"
        user.plan_expires_at = None
        await db.commit()
        break
    return auth_headers


@pytest.fixture
def mock_diagnoser(monkeypatch):
    """Mock R4 诊断 LLM 调用，避免测试依赖外部模型。"""

    def _fake_chat_r1(prompt: str) -> str:
        del prompt
        return '{"passed": true, "issues": []}'

    monkeypatch.setattr("app.services.diagnoser.chat_r1", _fake_chat_r1)
