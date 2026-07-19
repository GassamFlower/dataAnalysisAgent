"""数据库模型。"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, TypeDecorator
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """ORM 基类。"""
    pass


class UTCDateTime(TypeDecorator):
    """带时区感知的 DateTime 类型。

    SQLite 不保存时区信息，读取后可能为 naive datetime。此类型在读取时
    将 naive datetime 统一解释为 UTC，确保比较和序列化均为 aware。
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


# 导入所有模型，确保 Alembic 能检测到
from app.models.user import User
from app.models.project import Project
from app.models.question import Question
from app.models.hypothesis import Hypothesis
from app.models.hypothesis_path import HypothesisPath
from app.models.correlation_matrix import CorrelationMatrix
from app.models.simulation_config import SimulationConfig
from app.models.dataset import Dataset
from app.models.report import Report
from app.models.reliability_result import ReliabilityResult
from app.models.diagnosis import Diagnosis
from app.models.diagnosis_issue import DiagnosisIssue
from app.models.order import Order
from app.models.llm_config import LlmConfig

__all__ = [
    "Base",
    "User",
    "Project",
    "Question",
    "Hypothesis",
    "HypothesisPath",
    "CorrelationMatrix",
    "SimulationConfig",
    "Dataset",
    "Report",
    "ReliabilityResult",
    "Diagnosis",
    "DiagnosisIssue",
    "Order",
    "LlmConfig",
]
