"""题目结构数据模型。"""
from __future__ import annotations

from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class QuestionInspectRequest(BaseModel):
    """题目体检请求。"""

    text: str = Field(..., min_length=1, description="题目文本（支持多行）")


class QuestionResponse(BaseModel):
    """单题响应。"""

    id: UUID
    index: int
    text: str
    question_type: str
    dimension: str
    is_reverse: bool
    confidence: str

    class Config:
        from_attributes = True


class Question(BaseModel):
    """单题（业务逻辑用）。"""

    index: int
    text: str
    question_type: Literal["likert5", "likert7", "demographic", "other"]
    dimension: str
    is_reverse: bool = False
    confidence: Literal["high", "low"] = "high"


class QuestionnaireStructure(BaseModel):
    """题目结构 + 维度归属表（R1~R3 体检输出）。"""

    questions: List[Question]
    dimensions: List[str]
    scale_type: str


class QuestionUpdateRequest(BaseModel):
    """更新单题（PATCH）。仅允许修正 AI 识别结果，全字段可选。"""

    dimension: Optional[str] = Field(None, min_length=1, max_length=100)
    is_reverse: Optional[bool] = None
    confidence: Optional[Literal["high", "low"]] = None


class QuestionUploadResponse(BaseModel):
    """文件上传后返回提取到的原始文本。"""

    text: str
