"""学科量表库响应模型（Task 4.1 / 4.3）。"""
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ScaleItemOut(BaseModel):
    """量表条目（题目）。"""

    index: int = Field(..., description="条目序号")
    text: str = Field(..., description="条目标题")
    is_reverse: bool = Field(..., description="是否反向计分")


class ScaleDimensionOut(BaseModel):
    """量表维度（因子）。"""

    index: int = Field(..., description="维度序号")
    name: str = Field(..., description="维度名称")
    items: List[ScaleItemOut] = Field(default_factory=list, description="该维度下的条目")


class ScaleListItem(BaseModel):
    """量表列表项（精简字段，供列表/搜索展示）。"""

    id: UUID = Field(..., description="量表 ID")
    slug: str = Field(..., description="URL 友好标识")
    name: str = Field(..., description="量表名称")
    discipline: str = Field(..., description="学科：management / education / psychology")
    description: str = Field(description="量表简介")
    source: Optional[str] = Field(None, description="来源出处")
    reliability_ref: Optional[str] = Field(None, description="信度引用")
    validity_ref: Optional[str] = Field(None, description="效度引用")

    class Config:
        from_attributes = True


class ScaleDetail(ScaleListItem):
    """量表详情（含维度与条目）。"""

    scoring_method: str = Field(description="计分方式")
    dimensions: List[ScaleDimensionOut] = Field(default_factory=list, description="维度列表")

    class Config:
        from_attributes = True


class ScaleListResponse(BaseModel):
    """量表列表响应。"""

    items: List[ScaleListItem]
    total: int
    page: int
    page_size: int