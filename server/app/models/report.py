"""报告模型。"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import Integer, DateTime, ForeignKey, Index, Numeric
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Report(Base):
    """统计报告。"""

    __tablename__ = "reports"
    __table_args__ = (Index("idx_reports_project_id", "project_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id"), nullable=False
    )
    overall_alpha: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 3))
    passed_count: Mapped[Optional[int]] = mapped_column(Integer)
    total_count: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # 关联
    project: Mapped["Project"] = relationship(back_populates="reports")
    reliability_results: Mapped[List["ReliabilityResult"]] = relationship(
        back_populates="report"
    )
    diagnosis: Mapped[Optional["Diagnosis"]] = relationship(back_populates="report")
