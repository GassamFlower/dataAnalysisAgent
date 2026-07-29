"""数据集模块请求/响应模型。"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DatasetSource(str, Enum):
    """数据集来源。"""

    REAL = "real"
    SIMULATION = "simulation"


class DatasetTemplateFormat(str, Enum):
    """模板格式。"""

    CSV = "csv"
    XLSX = "xlsx"


class DatasetTemplateMatchBy(str, Enum):
    """模板列名匹配方式。"""

    INDEX = "index"
    TEXT = "text"


class DatasetInfoResponse(BaseModel):
    """数据集摘要响应。"""

    id: UUID = Field(..., description="数据集 ID")
    project_id: UUID = Field(..., description="项目 ID")
    source: DatasetSource = Field(..., description="数据来源")
    sample_size: int = Field(..., description="样本量")
    columns: List[str] = Field(..., description="列名列表")
    row_count: int = Field(..., description="数据行数")
    preview: List[Dict[str, Any]] = Field(
        default_factory=list, description="前 10 行预览"
    )
    created_at: datetime = Field(..., description="创建时间")


class DatasetImportResponse(DatasetInfoResponse):
    """真实数据导入响应。"""

    pass
