"""诊断问题模型。"""
import uuid
from decimal import Decimal

from sqlalchemy import String, Text, Numeric, ForeignKey, Index
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class DiagnosisIssue(Base):
    """不达标项明细。"""

    __tablename__ = "diagnosis_issues"
    __table_args__ = (Index("idx_diagnosis_issues_diagnosis_id", "diagnosis_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    diagnosis_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("diagnoses.id"), nullable=False
    )
    dimension: Mapped[str] = mapped_column(String(100), nullable=False)
    metric: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)
    threshold: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    suggestion: Mapped[str] = mapped_column(Text, nullable=False)

    # 关联
    diagnosis: Mapped["Diagnosis"] = relationship(back_populates="issues")
