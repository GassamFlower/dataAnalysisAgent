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


class ProjectDatasetOverview(BaseModel):
    """项目概览：最新数据集摘要。"""

    source: Optional[str] = None
    sample_size: Optional[int] = None
    imported_at: Optional[datetime] = None


class ProjectReportOverview(BaseModel):
    """项目概览：最新报告摘要。"""

    has_report: bool = False
    overall_alpha: Optional[float] = None
    passed_count: Optional[int] = None
    total_count: Optional[int] = None
    generated_at: Optional[datetime] = None


class ProjectOverview(BaseModel):
    """项目概览聚合数据（题目 / 数据集 / 报告）。"""

    question_count: int = 0
    dimension_count: int = 0
    reverse_count: int = 0
    dataset: ProjectDatasetOverview = Field(default_factory=ProjectDatasetOverview)
    report: ProjectReportOverview = Field(default_factory=ProjectReportOverview)


class ProjectResponse(BaseModel):
    """项目响应。"""

    id: UUID
    user_id: UUID
    name: str
    mode: str
    status: str
    created_at: datetime
    updated_at: datetime
    overview: ProjectOverview = Field(default_factory=ProjectOverview)

    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    """项目列表响应（精简字段）。"""

    id: UUID
    name: str
    mode: str
    status: str
    question_count: int = 0
    dimension_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
