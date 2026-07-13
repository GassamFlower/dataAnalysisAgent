"""模拟配置模型。"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, DateTime, ForeignKey, Index
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class SimulationConfig(Base):
    """数据生成参数。"""

    __tablename__ = "simulation_configs"
    __table_args__ = (Index("idx_simulation_configs_project_id", "project_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id"), nullable=False
    )
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    hypothesis_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("hypotheses.id")
    )
    matrix_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("correlation_matrices.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # 关联
    project: Mapped["Project"] = relationship(back_populates="simulation_configs")
    hypothesis: Mapped[Optional["Hypothesis"]] = relationship()
    matrix: Mapped[Optional["CorrelationMatrix"]] = relationship()
    dataset: Mapped[Optional["Dataset"]] = relationship(
        back_populates="simulation_config", uselist=False
    )
