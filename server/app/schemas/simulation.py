"""数据生成参数模型。"""
from __future__ import annotations

from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class HypothesisCreateRequest(BaseModel):
    """创建假设请求。"""

    raw_text: str = Field(..., min_length=1, description="用户一句话假设")


class HypothesisPathResponse(BaseModel):
    """假设路径响应。"""

    id: UUID
    predictor: str
    outcome: str
    direction: str
    strength: str

    class Config:
        from_attributes = True


class HypothesisResponse(BaseModel):
    """假设响应。"""

    id: UUID
    project_id: UUID
    raw_text: str
    paths: List[HypothesisPathResponse] = []

    class Config:
        from_attributes = True


class CorrelationMatrixResponse(BaseModel):
    """相关矩阵响应。"""

    id: UUID
    project_id: UUID
    dimensions: List
    cells: List

    class Config:
        from_attributes = True


class SimulationGenerateRequest(BaseModel):
    """数据生成请求。"""

    sample_size: int = Field(..., gt=0, description="样本量")
    hypothesis_id: UUID = Field(..., description="假设 ID")
    matrix_id: Optional[UUID] = Field(None, description="相关矩阵 ID（可选）")


class SimulationConfigResponse(BaseModel):
    """模拟配置响应。"""

    id: UUID
    project_id: UUID
    sample_size: int
    hypothesis_id: Optional[UUID]
    matrix_id: Optional[UUID]

    class Config:
        from_attributes = True


class MatrixCellResponse(BaseModel):
    """相关矩阵单元格。"""

    row: str
    col: str
    value: float
    source: str  # "user" | "system"


class HypothesisPathItem(BaseModel):
    """假设路径项（用于矩阵响应回传已保存路径）。"""

    predictor: str
    outcome: str
    direction: str
    strength: str


class SimulationMatrixResponse(BaseModel):
    """模拟矩阵响应（GET /simulation/{project_id}）。"""

    dimensions: List[str]
    cells: List[List[MatrixCellResponse]]
    hypothesis_text: Optional[str] = None
    paths: List[HypothesisPathItem] = []


class MatrixSaveCell(BaseModel):
    """保存矩阵单元格。"""

    row: str
    col: str
    value: float
    source: str  # "user" | "system"


class MatrixSaveRequest(BaseModel):
    """保存矩阵请求（PUT /simulation/{project_id}/matrix）。"""

    dimensions: List[str]
    cells: List[List[MatrixSaveCell]]


class MatrixSaveResponse(BaseModel):
    """保存矩阵响应。"""

    matrix_id: UUID
    project_id: UUID


class HypothesisPath(BaseModel):
    """假设主效应路径：自变量 → 因变量（业务逻辑用）。"""

    predictor: str
    outcome: str
    direction: Literal["positive", "negative"]
    strength: Literal["weak", "medium", "strong"]


class SimulationConfig(BaseModel):
    """数据生成参数（业务逻辑用）。"""

    sample_size: int
    paths: List[HypothesisPath]
