"""多供应商 LLM 客户端。

双模型架构：
- Flash：R1~R3 理解 / 推断 / 解析 / 轻量诊断，高频低成本
- Pro：R4 复杂因果诊断推理

模型选择策略：
- 优先从数据库 llm_configs 表读取配置（通过 config_service 缓存）
- 未配置时 fallback 到环境变量
- 任一 provider 未配置 API Key 时跳过
"""
import logging
from typing import List, Dict, Any, Tuple

from openai import OpenAI

from app.core.config import settings
from app.services.llm.config_service import (
    get_preferred_provider,
    get_flash_model,
    get_pro_model,
)

logger = logging.getLogger(__name__)

# ── Provider 配置表 ──────────────────────────────────────

PROVIDERS = {
    "deepseek": {
        "base_url": settings.DEEPSEEK_BASE_URL,
        "api_key": settings.DEEPSEEK_API_KEY,
    },
    "kimi": {
        "base_url": settings.KIMI_BASE_URL,
        "api_key": settings.KIMI_API_KEY,
    },
    "qwen": {
        "base_url": settings.QWEN_BASE_URL,
        "api_key": settings.QWEN_API_KEY,
    },
}

# 各 provider 的默认模型（环境变量 fallback）
DEFAULT_MODELS = {
    "deepseek": {
        "flash": settings.DEEPSEEK_V4_FLASH_MODEL,
        "pro": settings.DEEPSEEK_V4_PRO_MODEL,
    },
    "kimi": {
        "flash": settings.KIMI_K3_MODEL,
        "pro": settings.KIMI_K3_MODEL,
    },
    "qwen": {
        "flash": settings.QWEN_36_FLASH_MODEL,
        "pro": settings.QWEN_37_MAX_MODEL,
    },
}


def _get_client(base_url: str, api_key: str) -> OpenAI:
    """构造兼容 OpenAI SDK 的客户端。"""
    return OpenAI(api_key=api_key, base_url=base_url)


def _build_messages(prompt: str, system: str = "") -> List[Dict[str, Any]]:
    """构造对话消息列表。"""
    messages: List[Dict[str, Any]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return messages


def _chat_with_provider(
    base_url: str,
    api_key: str,
    model: str,
    messages: List[Dict[str, Any]],
    provider_name: str,
) -> str:
    """调用单个 provider，失败时抛出异常。"""
    logger.info("调用 LLM provider: %s, model: %s", provider_name, model)
    client = _get_client(base_url, api_key)
    resp = client.chat.completions.create(
        model=model,
        messages=messages,
    )
    content = resp.choices[0].message.content or ""
    logger.info("LLM provider 调用成功: %s", provider_name)
    return content


def _build_provider_list(model_type: str) -> List[Tuple[str, str, str, str]]:
    """根据数据库配置的优先 provider 构建调用列表。

    Args:
        model_type: "flash" 或 "pro"
    """
    preferred = get_preferred_provider()
    provider_order = list(PROVIDERS.keys())

    # 将优先 provider 移到列表首位
    if preferred in provider_order:
        provider_order.remove(preferred)
        provider_order.insert(0, preferred)

    providers = []
    for name in provider_order:
        cfg = PROVIDERS[name]
        if not cfg["api_key"]:
            continue
        # 模型名称：优先用数据库配置，fallback 到该 provider 的默认模型
        if model_type == "flash":
            model = get_flash_model()
        else:
            model = get_pro_model()
        providers.append((cfg["base_url"], cfg["api_key"], model, name.capitalize()))

    return providers


def chat_v3(prompt: str, system: str = "") -> str:
    """R1~R3 调用：题目理解 / 维度推断 / 假设解析。使用 Flash 级别模型。"""
    messages = _build_messages(prompt, system)
    providers = _build_provider_list("flash")
    return _try_providers(providers, messages, "chat_v3")


def chat_r1(prompt: str, system: str = "") -> str:
    """R4 调用：硬伤诊断推理。使用 Pro 级别模型。"""
    messages = _build_messages(prompt, system)
    providers = _build_provider_list("pro")
    return _try_providers(providers, messages, "chat_r1")


def _try_providers(
    providers: List[Tuple[str, str, str, str]],
    messages: List[Dict[str, Any]],
    call_name: str,
) -> str:
    """按顺序尝试 provider 列表，返回第一个成功的响应。"""
    errors: List[str] = []

    for base_url, api_key, model, provider_name in providers:
        if not api_key:
            logger.debug("跳过未配置 API Key 的 provider: %s", provider_name)
            continue

        try:
            return _chat_with_provider(base_url, api_key, model, messages, provider_name)
        except Exception as e:  # noqa: BLE001
            msg = f"{provider_name}({model}): {type(e).__name__}: {e}"
            logger.warning("%s 失败 - %s", call_name, msg)
            errors.append(msg)

    raise RuntimeError(
        f"{call_name} 所有可用 LLM provider 均调用失败。详情: {'; '.join(errors)}"
    )
