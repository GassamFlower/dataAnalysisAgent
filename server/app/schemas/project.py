"""项目相关模型。"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    """创建项目。"""

    name: str = Field(..., min_length=1, max_length=200, description="项目名称")


class ProjectUpdate(BaseModel):
    """更新项目。"""

    name: Optional[str] = Field(None, min_length=1, max_length=200)


class ProjectResponse(BaseModel):
    """项目响应。"""

    id: UUID
    user_id: UUID
    name: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    """项目列表响应（精简字段）。"""

    id: UUID
    name: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
