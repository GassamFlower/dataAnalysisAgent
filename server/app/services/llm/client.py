"""多供应商 LLM 客户端。

双模型架构：
- V4 Flash：R1~R3 理解 / 推断 / 解析 / 轻量诊断，高频低成本
- V4 Pro：R4 复杂因果诊断推理

主备策略：
- R1~R3 优先 DeepSeek V4 Flash，失败后自动降级 Kimi / 通义千问
- R4   优先 DeepSeek V4 Pro，失败后自动降级通义千问 Max
- 任一 provider 未配置 API Key 时跳过
"""
import logging
from typing import List, Dict, Any, Tuple

from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


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


def chat_v3(prompt: str, system: str = "") -> str:
    """R1~R3 调用：题目理解 / 维度推断 / 假设解析。使用 V4 Flash 级别模型。"""
    messages = _build_messages(prompt, system)

    providers = [
        (
            settings.DEEPSEEK_BASE_URL,
            settings.DEEPSEEK_API_KEY,
            settings.DEEPSEEK_V4_FLASH_MODEL,
            "DeepSeek",
        ),
        (
            settings.KIMI_BASE_URL,
            settings.KIMI_API_KEY,
            settings.KIMI_K3_MODEL,
            "Kimi",
        ),
        (
            settings.QWEN_BASE_URL,
            settings.QWEN_API_KEY,
            settings.QWEN_36_FLASH_MODEL,
            "Qwen",
        ),
    ]

    return _try_providers(providers, messages, "chat_v3")


def chat_r1(prompt: str, system: str = "") -> str:
    """R4 调用：硬伤诊断推理（为什么信效度不达标）。使用 V4 Pro 级别模型。"""
    messages = _build_messages(prompt, system)

    providers = [
        (
            settings.DEEPSEEK_BASE_URL,
            settings.DEEPSEEK_API_KEY,
            settings.DEEPSEEK_V4_PRO_MODEL,
            "DeepSeek",
        ),
        (
            settings.QWEN_BASE_URL,
            settings.QWEN_API_KEY,
            settings.QWEN_37_MAX_MODEL,
            "Qwen",
        ),
    ]

    return _try_providers(providers, messages, "chat_r1")
