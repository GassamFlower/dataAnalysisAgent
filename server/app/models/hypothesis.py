"""假设模型。"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import String, Text, ForeignKey, Index
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class Hypothesis(Base):
    """用户一句话假设。"""

    __tablename__ = "hypotheses"
    __table_args__ = (
        Index("idx_hypotheses_project_id", "project_id"),
        Index("idx_hypotheses_deleted_at", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    project: Mapped["Project"] = relationship(back_populates="hypotheses")
    paths: Mapped[List["HypothesisPath"]] = relationship(back_populates="hypothesis")
