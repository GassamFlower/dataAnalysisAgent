"""后端安全专项测试。

重点验证：
1. 软删除绕过：项目被删除后，questionnaire / simulation / report 接口不应再访问到该项目。
2. 水平越权：用户 B 无法访问用户 A 的项目资源。
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.main import _validate_production_settings
from app.models.project import Project
from app.models.question import Question
from app.models.user import User


USER_A_ID = uuid.UUID("00000000-0000-0000-0000-0000000000a1")
USER_B_ID = uuid.UUID("00000000-0000-0000-0000-0000000000b2")


async def _create_user(user_id: uuid.UUID, email: str, plan: str = "free") -> User:
    """在数据库中直接创建测试用户。"""
    async for db in get_db():
        user = await db.get(User, user_id)
        if not user:
            user = User(
                id=user_id,
                openid=f"test-openid-{user_id.hex}",
                email=email,
                email_verified=True,
                nickname=f"测试用户 {user_id.hex[:8]}",
                plan=plan,
            )
            db.add(user)
            await db.commit()
        return user


async def _token_for(user_id: uuid.UUID) -> str:
    """为用户生成 access token。"""
    return create_access_token(user_id)


async def _auth_headers_for(user_id: uuid.UUID) -> dict:
    """生成指定用户的认证头。"""
    token = await _token_for(user_id)
    return {"Authorization": f"Bearer {token}"}


async def _create_project_for_user(user_id: uuid.UUID, name: str = "安全测试项目") -> dict:
    """为指定用户创建一个项目。"""
    async for db in get_db():
        project = Project(
            id=uuid.uuid4(),
            user_id=user_id,
            name=name,
            status="draft",
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)
        return {
            "id": str(project.id),
            "user_id": str(project.user_id),
            "status": project.status,
        }


async def _add_question(project_id: uuid.UUID) -> None:
    """为项目添加一道题目，使问卷相关接口可测。"""
    async for db in get_db():
        db.add(
            Question(
                project_id=project_id,
                index=1,
                text="测试题目 1",
                question_type="likert5",
                dimension="测试维度",
                is_reverse=False,
                confidence="high",
            )
        )
        await db.commit()
        break


async def _soft_delete_project(project_id: uuid.UUID) -> None:
    """软删除指定项目。"""
    from datetime import datetime, timezone

    async for db in get_db():
        project = await db.get(Project, project_id)
        project.deleted_at = datetime.now(timezone.utc)
        project.updated_at = datetime.now(timezone.utc)
        await db.commit()
        break


@pytest.mark.anyio
async def test_deleted_project_questionnaire_inaccessible(client: AsyncClient):
    """软删除后，问卷接口应返回 404。"""
    await _create_user(USER_A_ID, "user_a@example.com")
    headers_a = await _auth_headers_for(USER_A_ID)
    project = await _create_project_for_user(USER_A_ID)
    project_id = project["id"]
    await _add_question(uuid.UUID(project_id))

    # 删除前可访问
    resp = await client.get(
        f"/api/v1/questionnaire/questions/{project_id}", headers=headers_a
    )
    assert resp.status_code == 200

    # 软删除
    await _soft_delete_project(uuid.UUID(project_id))

    # 删除后应 404
    resp = await client.get(
        f"/api/v1/questionnaire/questions/{project_id}", headers=headers_a
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_deleted_project_simulation_inaccessible(client: AsyncClient):
    """软删除后，模拟矩阵接口应返回 404。"""
    await _create_user(USER_A_ID, "user_a@example.com")
    headers_a = await _auth_headers_for(USER_A_ID)
    project = await _create_project_for_user(USER_A_ID)
    project_id = project["id"]
    await _add_question(uuid.UUID(project_id))

    resp = await client.get(
        f"/api/v1/simulation/{project_id}", headers=headers_a
    )
    assert resp.status_code == 200

    await _soft_delete_project(uuid.UUID(project_id))

    resp = await client.get(
        f"/api/v1/simulation/{project_id}", headers=headers_a
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_deleted_project_report_inaccessible(client: AsyncClient):
    """软删除后，报告接口应返回 404。"""
    await _create_user(USER_A_ID, "user_a@example.com")
    headers_a = await _auth_headers_for(USER_A_ID)
    project = await _create_project_for_user(USER_A_ID)
    project_id = project["id"]

    resp = await client.get(f"/api/v1/report/{project_id}", headers=headers_a)
    assert resp.status_code == 404  # 本来就没有报告

    await _soft_delete_project(uuid.UUID(project_id))

    # 删除后仍应 404（不会因为没有报告而变成其他异常）
    resp = await client.get(f"/api/v1/report/{project_id}", headers=headers_a)
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_horizontal_auth_project_access(client: AsyncClient):
    """用户 B 不能访问用户 A 的项目资源。"""
    await _create_user(USER_A_ID, "user_a@example.com")
    await _create_user(USER_B_ID, "user_b@example.com")
    headers_a = await _auth_headers_for(USER_A_ID)
    headers_b = await _auth_headers_for(USER_B_ID)

    project = await _create_project_for_user(USER_A_ID)
    project_id = project["id"]
    await _add_question(uuid.UUID(project_id))

    # 用户 B 访问用户 A 的问卷接口
    resp = await client.get(
        f"/api/v1/questionnaire/questions/{project_id}", headers=headers_b
    )
    assert resp.status_code == 404

    # 用户 B 访问用户 A 的模拟接口
    resp = await client.get(
        f"/api/v1/simulation/{project_id}", headers=headers_b
    )
    assert resp.status_code == 404

    # 用户 B 访问用户 A 的报告接口
    resp = await client.get(f"/api/v1/report/{project_id}", headers=headers_b)
    assert resp.status_code == 404

    # 用户 A 仍可正常访问
    resp = await client.get(
        f"/api/v1/questionnaire/questions/{project_id}", headers=headers_a
    )
    assert resp.status_code == 200


def _save_settings():
    """保存当前 settings，用于测试后恢复。"""
    return {
        "ENVIRONMENT": settings.ENVIRONMENT,
        "DEBUG": settings.DEBUG,
        "ALLOW_DEV_TOKEN": settings.ALLOW_DEV_TOKEN,
        "JWT_SECRET_KEY": settings.JWT_SECRET_KEY,
        "RESET_JWT_SECRET_KEY": settings.RESET_JWT_SECRET_KEY,
    }


def _restore_settings(saved: dict):
    """恢复 settings。"""
    settings.ENVIRONMENT = saved["ENVIRONMENT"]
    settings.DEBUG = saved["DEBUG"]
    settings.ALLOW_DEV_TOKEN = saved["ALLOW_DEV_TOKEN"]
    settings.JWT_SECRET_KEY = saved["JWT_SECRET_KEY"]
    settings.RESET_JWT_SECRET_KEY = saved["RESET_JWT_SECRET_KEY"]


def _setup_production_valid():
    """设置生产环境合法配置。"""
    settings.ENVIRONMENT = "production"
    settings.DEBUG = False
    settings.ALLOW_DEV_TOKEN = False
    settings.JWT_SECRET_KEY = "strong_secret_key_at_least_32_chars_long"
    settings.RESET_JWT_SECRET_KEY = "another_strong_secret_key_for_reset_only"


def test_production_rejects_debug():
    """生产环境 DEBUG=True 时启动校验应失败。"""
    saved = _save_settings()
    _setup_production_valid()
    settings.DEBUG = True
    try:
        with pytest.raises(RuntimeError, match="DEBUG=False"):
            _validate_production_settings()
    finally:
        _restore_settings(saved)


def test_production_rejects_allow_dev_token():
    """生产环境 ALLOW_DEV_TOKEN=True 时启动校验应失败。"""
    saved = _save_settings()
    _setup_production_valid()
    settings.ALLOW_DEV_TOKEN = True
    try:
        with pytest.raises(RuntimeError, match="ALLOW_DEV_TOKEN=False"):
            _validate_production_settings()
    finally:
        _restore_settings(saved)


def test_production_rejects_short_jwt_secret():
    """生产环境 JWT_SECRET_KEY 短于 32 位时启动校验应失败。"""
    saved = _save_settings()
    _setup_production_valid()
    settings.JWT_SECRET_KEY = "short"
    try:
        with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
            _validate_production_settings()
    finally:
        _restore_settings(saved)


def test_production_rejects_short_reset_jwt_secret():
    """生产环境 RESET_JWT_SECRET_KEY 短于 32 位时启动校验应失败。"""
    saved = _save_settings()
    _setup_production_valid()
    settings.RESET_JWT_SECRET_KEY = "short"
    try:
        with pytest.raises(RuntimeError, match="RESET_JWT_SECRET_KEY"):
            _validate_production_settings()
    finally:
        _restore_settings(saved)


def test_production_rejects_same_reset_jwt_secret():
    """生产环境 RESET_JWT_SECRET_KEY 与 JWT_SECRET_KEY 相同时启动校验应失败。"""
    saved = _save_settings()
    _setup_production_valid()
    settings.RESET_JWT_SECRET_KEY = settings.JWT_SECRET_KEY
    try:
        with pytest.raises(RuntimeError, match="RESET_JWT_SECRET_KEY 必须与 JWT_SECRET_KEY 不同"):
            _validate_production_settings()
    finally:
        _restore_settings(saved)


def test_production_accepts_valid_settings():
    """生产环境配置正确时启动校验应通过。"""
    saved = _save_settings()
    _setup_production_valid()
    try:
        _validate_production_settings()
    finally:
        _restore_settings(saved)


def test_non_production_skips_validation():
    """非生产环境即使配置不安全也不触发校验。"""
    saved = _save_settings()
    settings.ENVIRONMENT = "development"
    settings.DEBUG = True
    settings.ALLOW_DEV_TOKEN = True
    settings.JWT_SECRET_KEY = ""
    settings.RESET_JWT_SECRET_KEY = ""
    try:
        _validate_production_settings()
    finally:
        _restore_settings(saved)
