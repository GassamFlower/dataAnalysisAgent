"""LLM 配置服务。

启动时从数据库加载 LLM 配置到内存缓存，
LLM client 同步读取缓存，未配置时 fallback 到环境变量。
配置更新后调用 reload_from_db() 重新加载。
"""
import logging
from typing import Dict

from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session
from app.models.llm_config import LlmConfig

logger = logging.getLogger(__name__)

# 合法的 provider 列表（白名单）
VALID_PROVIDERS = ("deepseek", "kimi", "qwen")

# 内存缓存（启动时加载，配置更新时重新加载）
_config_cache: Dict[str, str] = {}


async def reload_from_db():
    """从数据库重新加载配置到缓存。"""
    global _config_cache
    new_cache: Dict[str, str] = {}
    try:
        async with async_session() as session:
            result = await session.execute(
                select(LlmConfig).where(LlmConfig.is_enabled == True)
            )
            for config in result.scalars().all():
                new_cache[config.config_key] = config.config_value
    except Exception as e:
        logger.warning("从数据库加载 LLM 配置失败，使用环境变量 fallback: %s", e)
    _config_cache = new_cache
    logger.info("LLM 配置已加载: %s", _config_cache)


def get_config(key: str, fallback: str) -> str:
    """获取配置值，优先缓存，fallback 到默认值。"""
    return _config_cache.get(key, fallback)


def get_preferred_provider() -> str:
    """获取优先使用的 provider（deepseek/kimi/qwen）。"""
    return get_config("llm.preferred_provider", "deepseek")


def get_flash_model() -> str:
    """获取 R1-R3 使用的模型名称。"""
    return get_config("llm.flash_model", settings.DEEPSEEK_V4_FLASH_MODEL)


def get_pro_model() -> str:
    """获取 R4 使用的模型名称。"""
    return get_config("llm.pro_model", settings.DEEPSEEK_V4_PRO_MODEL)


def get_all_configs() -> Dict[str, str]:
    """获取所有缓存配置。"""
    return dict(_config_cache)
