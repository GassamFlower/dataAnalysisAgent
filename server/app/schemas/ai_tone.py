"""文字体检（去 AI 味）请求与响应模型。"""
from typing import Any, Dict, List

from pydantic import BaseModel, Field


class AiToneAnalyzeRequest(BaseModel):
    """检测请求。"""

    text: str = Field(..., description="待检测文本，单次最多 8000 字")


class AiToneAnalyzeResponse(BaseModel):
    """检测结果。"""

    meta: Dict[str, int]
    summary: Dict[str, int]
    groups: List[Dict[str, Any]]
    fingerprints: List[Dict[str, Any]]
    structure: List[Dict[str, Any]]
    keep: List[Dict[str, Any]]
    limits: Dict[str, int]


class AiToneRewriteRequest(BaseModel):
    """改写请求。"""

    text: str = Field(..., description="待改写文本，单次最多 8000 字")


class AiToneRewriteResponse(BaseModel):
    """改写结果（含前后检测）。"""

    text: str
    semantic_issues: List[Dict[str, str]] = []
    changes: List[Dict[str, str]] = []
    before: Dict[str, Any]
    after: Dict[str, Any]
    disclaimer: str
