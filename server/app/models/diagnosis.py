"""诊断模型。"""
import uuid
from datetime import datetime
from typing import List

from sqlalchemy import Boolean, DateTime, ForeignKey, Index
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Diagnosis(Base):
    """R4 诊断结论。"""

    __tablename__ = "diagnoses"
    __table_args__ = (Index("idx_diagnoses_report_id", "report_id", unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("reports.id"), nullable=False, unique=True
    )
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # 关联
    report: Mapped["Report"] = relationship(back_populates="diagnosis")
    issues: Mapped[List["DiagnosisIssue"]] = relationship(back_populates="diagnosis")
