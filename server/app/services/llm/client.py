"""DeepSeek LLM 客户端。

双模型架构：
- V4 Flash：R1~R3 理解 / 推断 / 解析 / 轻量诊断，高频低成本
- V4 Pro：R4 复杂因果诊断推理
"""
from openai import OpenAI

from app.core.config import settings


def _get_client() -> OpenAI:
    """构造 DeepSeek 客户端（兼容 OpenAI SDK）。"""
    return OpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
    )


def chat_v3(prompt: str, system: str = "") -> str:
    """R1~R3 调用：题目理解 / 维度推断 / 假设解析。使用 V4 Flash。"""
    client = _get_client()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    resp = client.chat.completions.create(
        model=settings.DEEPSEEK_V4_FLASH_MODEL,
        messages=messages,
    )
    return resp.choices[0].message.content or ""


def chat_r1(prompt: str, system: str = "") -> str:
    """R4 调用：硬伤诊断推理（为什么信效度不达标）。使用 V4 Pro。"""
    client = _get_client()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    resp = client.chat.completions.create(
        model=settings.DEEPSEEK_V4_PRO_MODEL,
        messages=messages,
    )
    return resp.choices[0].message.content or ""
