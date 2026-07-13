"""相关矩阵模型。"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index
from sqlalchemy import Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class CorrelationMatrix(Base):
    """维度间相关系数矩阵。"""

    __tablename__ = "correlation_matrices"
    __table_args__ = (Index("idx_correlation_matrices_project_id", "project_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id"), nullable=False
    )
    dimensions: Mapped[dict] = mapped_column(JSON, nullable=False)
    cells: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # 关联
    project: Mapped["Project"] = relationship(back_populates="correlation_matrices")
