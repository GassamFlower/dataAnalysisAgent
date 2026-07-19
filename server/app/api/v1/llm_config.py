"""LLM 配置管理 API（仅管理员可访问）。"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.responses import success_response
from app.models.llm_config import LlmConfig
from app.services.llm.config_service import (
    VALID_PROVIDERS,
    reload_from_db,
)

router = APIRouter(prefix="/llm-configs", tags=["LLM 配置管理"])


# ── Schemas ──────────────────────────────────────────────


class LlmConfigItem(BaseModel):
    config_key: str
    config_value: str
    description: Optional[str] = ""
    is_enabled: bool = True

    @field_validator("config_value")
    @classmethod
    def validate_config_value(cls, v: str) -> str:
        return v.strip()


class LlmConfigUpdateRequest(BaseModel):
    config_value: str
    is_enabled: Optional[bool] = None

    @field_validator("config_value")
    @classmethod
    def validate_config_value(cls, v: str) -> str:
        return v.strip()


# ── Helpers ──────────────────────────────────────────────


def _check_admin(current_user: dict):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="仅管理员可操作 LLM 配置")


def _config_to_dict(c: LlmConfig) -> dict:
    return {
        "id": c.id,
        "config_key": c.config_key,
        "config_value": c.config_value,
        "description": c.description or "",
        "is_enabled": c.is_enabled,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


# ─ Routes ───────────────────────────────────────────────


@router.get("")
async def list_llm_configs(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取所有 LLM 配置（管理员）。"""
    _check_admin(current_user)
    result = await db.execute(
        select(LlmConfig).order_by(LlmConfig.config_key)
    )
    configs = result.scalars().all()
    return success_response(data={"items": [_config_to_dict(c) for c in configs]})


@router.post("")
async def create_llm_config(
    req: LlmConfigItem,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建 LLM 配置项（管理员）。"""
    _check_admin(current_user)

    # 白名单校验
    if req.config_key == "llm.preferred_provider" and req.config_value not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"preferred_provider 只能是: {', '.join(VALID_PROVIDERS)}",
        )

    # 检查是否已存在
    result = await db.execute(
        select(LlmConfig).where(LlmConfig.config_key == req.config_key)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该配置键已存在")

    config = LlmConfig(
        config_key=req.config_key,
        config_value=req.config_value,
        description=req.description,
        is_enabled=req.is_enabled,
    )
    db.add(config)
    await db.commit()

    await reload_from_db()
    return success_response(data=_config_to_dict(config))


@router.patch("/{config_id}")
async def update_llm_config(
    config_id: int,
    req: LlmConfigUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新 LLM 配置项（管理员）。"""
    _check_admin(current_user)

    config = await db.get(LlmConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="配置项不存在")

    # 白名单校验
    if config.config_key == "llm.preferred_provider" and req.config_value not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"preferred_provider 只能是: {', '.join(VALID_PROVIDERS)}",
        )

    config.config_value = req.config_value
    if req.is_enabled is not None:
        config.is_enabled = req.is_enabled
    await db.commit()

    refresh_cache()
    return success_response(data=_config_to_dict(config))


@router.delete("/{config_id}")
async def delete_llm_config(
    config_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除 LLM 配置项（管理员）。"""
    _check_admin(current_user)

    config = await db.get(LlmConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="配置项不存在")

    await db.delete(config)
    await db.commit()

    await reload_from_db()
    return success_response(message="配置项已删除")
