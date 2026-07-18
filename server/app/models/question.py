"""题目模型。"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Text, Boolean, ForeignKey, Index, UniqueConstraint, CheckConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class Question(Base):
    """问卷题目（体检后生成）。"""

    __tablename__ = "questions"
    __table_args__ = (
        Index("idx_questions_project_id", "project_id"),
        Index("idx_questions_deleted_at", "deleted_at"),
        UniqueConstraint("project_id", "index"),
        CheckConstraint("is_reverse IN (0, 1)", name="ck_questions_is_reverse"),
        CheckConstraint(
            "question_type IN ('likert5', 'likert7', 'demographic', 'other')",
            name="ck_questions_question_type",
        ),
        CheckConstraint("confidence IN ('high', 'low')", name="ck_questions_confidence"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(20), nullable=False)
    dimension: Mapped[str] = mapped_column(String(100), nullable=False)
    is_reverse: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[str] = mapped_column(String(10), default="high")
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    project: Mapped["Project"] = relationship(back_populates="questions")
