"""相关矩阵模型。"""
import uuid
from datetime import datetime, timezone

from typing import Optional

from sqlalchemy import ForeignKey, Index
from sqlalchemy import Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class CorrelationMatrix(Base):
    """维度间相关系数矩阵。"""

    __tablename__ = "correlation_matrices"
    __table_args__ = (
        Index("idx_correlation_matrices_project_id", "project_id"),
        Index("idx_correlation_matrices_deleted_at", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    dimensions: Mapped[dict] = mapped_column(JSON, nullable=False)
    cells: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    project: Mapped["Project"] = relationship(back_populates="correlation_matrices")
