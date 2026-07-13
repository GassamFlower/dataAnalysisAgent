"""假设路径模型。"""
import uuid

from sqlalchemy import String, ForeignKey, Index
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class HypothesisPath(Base):
    """LLM 解析的主效应路径。"""

    __tablename__ = "hypothesis_paths"
    __table_args__ = (Index("idx_hypothesis_paths_hypothesis_id", "hypothesis_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("hypotheses.id"), nullable=False
    )
    predictor: Mapped[str] = mapped_column(String(100), nullable=False)
    outcome: Mapped[str] = mapped_column(String(100), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    strength: Mapped[str] = mapped_column(String(10), nullable=False)

    # 关联
    hypothesis: Mapped["Hypothesis"] = relationship(back_populates="paths")
