"""假设路径模型。"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, ForeignKey, Index, CheckConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class HypothesisPath(Base):
    """LLM 解析的主效应路径。"""

    __tablename__ = "hypothesis_paths"
    __table_args__ = (
        Index("idx_hypothesis_paths_hypothesis_id", "hypothesis_id"),
        Index("idx_hypothesis_paths_deleted_at", "deleted_at"),
        CheckConstraint("direction IN ('positive', 'negative')", name="ck_hypothesis_paths_direction"),
        CheckConstraint("strength IN ('weak', 'medium', 'strong')", name="ck_hypothesis_paths_strength"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("hypotheses.id", ondelete="CASCADE"), nullable=False
    )
    predictor: Mapped[str] = mapped_column(String(100), nullable=False)
    outcome: Mapped[str] = mapped_column(String(100), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    strength: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    hypothesis: Mapped["Hypothesis"] = relationship(back_populates="paths")
