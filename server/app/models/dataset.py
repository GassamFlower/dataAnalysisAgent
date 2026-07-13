"""数据集模型。"""
import uuid
from datetime import datetime

from sqlalchemy import Integer, DateTime, ForeignKey, Index
from sqlalchemy import Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Dataset(Base):
    """生成的模拟数据集。"""

    __tablename__ = "datasets"
    __table_args__ = (
        Index("idx_datasets_simulation_config_id", "simulation_config_id", unique=True),
        Index("idx_datasets_project_id", "project_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    simulation_config_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("simulation_configs.id"),
        nullable=False,
        unique=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id"), nullable=False
    )
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    columns: Mapped[list] = mapped_column(JSON, nullable=False)
    data: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # 关联
    simulation_config: Mapped["SimulationConfig"] = relationship(
        back_populates="dataset"
    )
    project: Mapped["Project"] = relationship(back_populates="datasets")
