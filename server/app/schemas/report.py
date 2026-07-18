"""报告相关模型。"""
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReliabilityResultResponse(BaseModel):
    """信效度结果响应。"""

    id: UUID
    report_id: UUID
    dimension: str
    alpha: float
    kmo: float
    bartlett_p_value: float = Field(
        ...,
        validation_alias="bartlett_pvalue",
        serialization_alias="bartlett_p_value",
    )
    passed: bool
    # 分档等级与论文措辞（模型计算属性，不落库）
    alpha_grade: Optional[str] = None
    alpha_wording: Optional[str] = None
    kmo_grade: Optional[str] = None
    kmo_wording: Optional[str] = None
    bartlett_grade: Optional[str] = None
    bartlett_wording: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DiagnosisIssueResponse(BaseModel):
    """诊断问题响应。"""

    id: UUID
    dimension: str
    metric: str
    value: float
    threshold: float
    reason: str
    suggestion: str

    model_config = ConfigDict(from_attributes=True)


class DiagnosisResponse(BaseModel):
    """诊断响应。"""

    id: UUID
    report_id: UUID
    passed: bool
    issues: List[DiagnosisIssueResponse] = []

    model_config = ConfigDict(from_attributes=True)


class DiffTestResultResponse(BaseModel):
    """差异检验结果响应（不落库，按假设路径实时计算）。

    对应后端架构文档 9.6 节决策树输出。
    """

    predictor: str
    outcome: str
    method: Optional[str] = None
    method_name: Optional[str] = None
    iv_type: Optional[str] = None
    dv_type: Optional[str] = None
    group_count: Optional[int] = None
    statistic: Optional[float] = None
    p_value: Optional[float] = None
    effect_size: Optional[float] = None
    effect_size_name: Optional[str] = None
    effect_size_grade: Optional[str] = None
    significant: Optional[bool] = None
    interpretation: Optional[str] = None
    error: Optional[str] = None
    # 允许附加字段（如回归 coefficients、卡方 dof）
    model_config = ConfigDict(extra="allow")


class ReportResponse(BaseModel):
    """报告响应。"""

    id: UUID
    project_id: UUID
    overall_alpha: Optional[float] = None
    passed_count: Optional[int] = None
    total_count: Optional[int] = None
    reliability_results: List[ReliabilityResultResponse] = []
    diagnosis: Optional[DiagnosisResponse] = None
    # 差异检验结果（不落库，实时计算注入）
    diff_tests: Optional[List[DiffTestResultResponse]] = None
    # 样本量（不落库，从 SimulationConfig 实时查询注入）
    sample_size: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExportRequest(BaseModel):
    """导出请求。"""

    format: str = "word"  # word / excel
