"""假设模型。"""
import uuid
from datetime import datetime
from typing import List

from sqlalchemy import String, Text, DateTime, ForeignKey, Index
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Hypothesis(Base):
    """用户一句话假设。"""

    __tablename__ = "hypotheses"
    __table_args__ = (Index("idx_hypotheses_project_id", "project_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id"), nullable=False
    )
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # 关联
    project: Mapped["Project"] = relationship(back_populates="hypotheses")
    paths: Mapped[List["HypothesisPath"]] = relationship(back_populates="hypothesis")
