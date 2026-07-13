"""项目模型。"""
import uuid
from datetime import datetime
from typing import List

from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Project(Base):
    """问卷研究预演项目。"""

    __tablename__ = "projects"
    __table_args__ = (
        Index("idx_projects_user_id", "user_id"),
        Index("idx_projects_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

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
