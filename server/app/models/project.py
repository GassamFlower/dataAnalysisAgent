"""项目模型。"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import String, ForeignKey, Index, CheckConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class Project(Base):
    """问卷研究预演项目。"""

    __tablename__ = "projects"
    __table_args__ = (
        Index("idx_projects_user_id", "user_id"),
        Index("idx_projects_status", "status"),
        Index("idx_projects_mode", "mode"),
        Index("idx_projects_user_id_status", "user_id", "status"),
        Index("idx_projects_deleted_at", "deleted_at"),
        CheckConstraint(
            "status IN ('draft', 'inspected', 'hypothesized', 'simulated', 'analyzed')",
            name="ck_projects_status",
        ),
        CheckConstraint(
            "mode IN ('real', 'simulation')",
            name="ck_projects_mode",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # 合规字段（F-SYS-007）：项目模式，区分真实数据分析与模拟预演
    mode: Mapped[str] = mapped_column(String(20), default="real")
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    user: Mapped["User"] = relationship(back_populates="projects")
    questions: Mapped[List["Question"]] = relationship(back_populates="project")
    hypotheses: Mapped[List["Hypothesis"]] = relationship(back_populates="project")
    correlation_matrices: Mapped[List["CorrelationMatrix"]] = relationship(
        back_populates="project"
    )
    simulation_configs: Mapped[List["SimulationConfig"]] = relationship(
        back_populates="project"
    )
    datasets: Mapped[List["Dataset"]] = relationship(back_populates="project")
    reports: Mapped[List["Report"]] = relationship(back_populates="project")
