"""DeepSeek LLM 客户端。

双模型架构：
- V3（deepseek-chat）：R1~R3 理解 / 推断 / 解析，高频低成本
- R1（deepseek-reasoner）：R4 硬伤诊断推理，思维链适合因果诊断
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
    """R1~R3 调用：题目理解 / 维度推断 / 假设解析。"""
    client = _get_client()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    resp = client.chat.completions.create(
        model=settings.DEEPSEEK_V3_MODEL,
        messages=messages,
    )
    return resp.choices[0].message.content or ""


def chat_r1(prompt: str, system: str = "") -> str:
    """R4 调用：硬伤诊断推理（为什么信效度不达标）。"""
    client = _get_client()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    resp = client.chat.completions.create(
        model=settings.DEEPSEEK_R1_MODEL,
        messages=messages,
    )
    return resp.choices[0].message.content or ""
