"""留言（售后）相关模型。"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.message import (
    TAG_CHOICES,
    DATA_SOURCE_CHOICES,
    STATUS_CHOICES,
)

# 五类标签中文名（与立项文档 §4.3 一致，仅展示用，落库为 ASCII 码）
TAG_LABELS = {
    "presale": "售前咨询",
    "rescue": "报告救急",
    "service": "人工服务",
    "incident": "故障反馈",
    "feedback": "产品建议",
}

DATA_SOURCE_LABELS = {
    "real": "真实数据",
    "simulation": "模拟数据",
}

STATUS_LABELS = {
    "pending": "待处理",
    "processing": "处理中",
    "done": "已处理",
}


class MessageCreate(BaseModel):
    """创建留言。"""

    tag: str = Field(..., description="留言分类（售前/救急/服务/故障/反馈）")
    content: str = Field(..., min_length=1, max_length=5000, description="留言内容")
    project_id: Optional[UUID] = Field(None, description="关联项目 ID（可选）")
    data_source: Optional[str] = Field(None, description="数据源类型：real/simulation")
    contact: Optional[str] = Field(None, max_length=120, description="联系方式")
    entry_point: Optional[str] = Field(None, max_length=40, description="来源入口")


class MessageStatusUpdate(BaseModel):
    """更新留言处理状态。"""

    status: str = Field(..., description="目标状态：pending/processing/done")
    handle_remark: Optional[str] = Field(None, max_length=1000, description="处理备注")


class MessageResponse(BaseModel):
    """留言详情。"""

    id: UUID
    user_id: UUID
    project_id: Optional[UUID] = None
    tag: str
    tag_label: str
    data_source: Optional[str] = None
    data_source_label: Optional[str] = None
    entry_point: Optional[str] = None
    contact: Optional[str] = None
    content: str
    status: str
    status_label: str
    handled_by: Optional[UUID] = None
    handled_at: Optional[datetime] = None
    handle_remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime


def validate_tag(tag: str) -> str:
    if tag not in TAG_CHOICES:
        raise ValueError(f"tag 必须是 {' / '.join(TAG_CHOICES)} 之一")
    return tag


# 供 schema 层复用的校验常量
__all__ = [
    "TAG_CHOICES",
    "DATA_SOURCE_CHOICES",
    "STATUS_CHOICES",
    "TAG_LABELS",
    "DATA_SOURCE_LABELS",
    "STATUS_LABELS",
    "MessageCreate",
    "MessageStatusUpdate",
    "MessageResponse",
]