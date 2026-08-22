"""数据生成参数模型。"""
from __future__ import annotations

from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


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

    model_config = ConfigDict(from_attributes=True)


class HypothesisResponse(BaseModel):
    """假设响应。"""

    id: UUID
    project_id: UUID
    raw_text: str
    paths: List[HypothesisPathResponse] = []

    model_config = ConfigDict(from_attributes=True)


class CorrelationMatrixResponse(BaseModel):
    """相关矩阵响应。"""

    id: UUID
    project_id: UUID
    dimensions: List
    cells: List

    model_config = ConfigDict(from_attributes=True)


class SimulationGenerateRequest(BaseModel):
    """数据生成请求。"""

    # 样本量合理上限：防止超大请求造成内存/CPU DoS（生成矩阵为 N×D 数组）
    sample_size: int = Field(..., gt=0, le=100000, description="样本量（1~100000）")
    # 后端按 project_id 自动取最新 hypothesis 与 matrix，前端无需传入


class SimulationConfigResponse(BaseModel):
    """模拟配置响应。"""

    id: UUID
    project_id: UUID
    sample_size: int
    hypothesis_id: Optional[UUID]
    matrix_id: Optional[UUID]

    model_config = ConfigDict(from_attributes=True)


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
    value: float = Field(..., ge=-1.0, le=1.0, description="相关系数必须在 [-1, 1]")
    source: str  # "user" | "system"


class MatrixSaveRequest(BaseModel):
    """保存矩阵请求（PUT /simulation/{project_id}/matrix）。"""

    dimensions: List[str]
    cells: List[List[MatrixSaveCell]]

    @model_validator(mode="after")
    def _validate_matrix_shape_and_diagonal(self) -> "MatrixSaveRequest":
        n = len(self.dimensions)
        if n < 1:
            raise ValueError("矩阵至少需要 1 个维度")
        if len(self.cells) != n:
            raise ValueError(f"矩阵行数 {len(self.cells)} 与维度数 {n} 不一致")
        for i, row in enumerate(self.cells):
            if len(row) != n:
                raise ValueError(f"矩阵第 {i} 行长度 {len(row)} 与维度数 {n} 不一致")
        # 校验对角线必须为 1（变量与自身相关为 1）
        for i in range(n):
            diag = self.cells[i][i]
            if diag.row != self.dimensions[i] or diag.col != self.dimensions[i]:
                raise ValueError(f"矩阵对角线位置 ({i},{i}) 维度名不一致")
            if abs(diag.value - 1.0) > 1e-6:
                raise ValueError(f"矩阵对角线 {self.dimensions[i]} 相关必须为 1")
        return self


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


class DatasetExportRequest(BaseModel):
    """模拟数据集导出请求。"""

    format: Literal["excel", "csv"] = Field(
        default="excel", description="导出格式：excel 或 csv"
    )
    data_source: Literal["real", "simulated"] = Field(
        default="simulated", description="数据来源类型：真实数据或模拟数据"
    )
