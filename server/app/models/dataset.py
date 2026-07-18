"""数据集模型。"""
import uuid
from datetime import datetime, timezone

from typing import Optional

from sqlalchemy import Integer, ForeignKey, Index, CheckConstraint
from sqlalchemy import Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class Dataset(Base):
    """生成的模拟数据集。"""

    __tablename__ = "datasets"
    __table_args__ = (
        Index("idx_datasets_project_id", "project_id"),
        Index("idx_datasets_deleted_at", "deleted_at"),
        CheckConstraint("sample_size > 0", name="ck_datasets_sample_size"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    simulation_config_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("simulation_configs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    columns: Mapped[list] = mapped_column(JSON, nullable=False)
    data: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    simulation_config: Mapped["SimulationConfig"] = relationship(
        back_populates="dataset"
    )
    project: Mapped["Project"] = relationship(back_populates="datasets")
