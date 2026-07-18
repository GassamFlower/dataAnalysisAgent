"""报告模型。"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import Integer, ForeignKey, Index, Numeric
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class Report(Base):
    """统计报告。"""

    __tablename__ = "reports"
    __table_args__ = (
        Index("idx_reports_project_id", "project_id"),
        Index("idx_reports_dataset_id", "dataset_id"),
        Index("idx_reports_deleted_at", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    dataset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("datasets.id", ondelete="SET NULL")
    )
    overall_alpha: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 3))
    passed_count: Mapped[Optional[int]] = mapped_column(Integer)
    total_count: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    project: Mapped["Project"] = relationship(back_populates="reports")
    dataset: Mapped[Optional["Dataset"]] = relationship()
    reliability_results: Mapped[List["ReliabilityResult"]] = relationship(
        back_populates="report"
    )
    diagnosis: Mapped[Optional["Diagnosis"]] = relationship(back_populates="report")
