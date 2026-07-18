"""模拟配置模型。"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Integer, ForeignKey, Index, CheckConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class SimulationConfig(Base):
    """数据生成参数。"""

    __tablename__ = "simulation_configs"
    __table_args__ = (
        Index("idx_simulation_configs_project_id", "project_id"),
        Index("idx_simulation_configs_hypothesis_id", "hypothesis_id"),
        Index("idx_simulation_configs_matrix_id", "matrix_id"),
        Index("idx_simulation_configs_deleted_at", "deleted_at"),
        CheckConstraint("sample_size > 0", name="ck_simulation_configs_sample_size"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    hypothesis_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("hypotheses.id", ondelete="SET NULL")
    )
    matrix_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("correlation_matrices.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    project: Mapped["Project"] = relationship(back_populates="simulation_configs")
    hypothesis: Mapped[Optional["Hypothesis"]] = relationship()
    matrix: Mapped[Optional["CorrelationMatrix"]] = relationship()
    dataset: Mapped[Optional["Dataset"]] = relationship(
        back_populates="simulation_config", uselist=False
    )
