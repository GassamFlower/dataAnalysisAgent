"""诊断模型。"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Boolean, ForeignKey, Index, CheckConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class Diagnosis(Base):
    """R4 诊断结论。"""

    __tablename__ = "diagnoses"
    __table_args__ = (
        Index("idx_diagnoses_report_id", "report_id"),
        Index("idx_diagnoses_deleted_at", "deleted_at"),
        CheckConstraint("passed IN (0, 1)", name="ck_diagnoses_passed"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    report: Mapped["Report"] = relationship(back_populates="diagnosis")
    issues: Mapped[List["DiagnosisIssue"]] = relationship(back_populates="diagnosis")
