"""数据库模型。"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """ORM 基类。"""
    pass


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
]
