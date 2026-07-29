"""用户教程进度模型。"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from sqlalchemy import String, Index, UniqueConstraint, JSON, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, UTCDateTime


class UserTutorialProgress(Base):
    """用户新手引导进度（教程 F-TUT-004）。"""

    __tablename__ = "user_tutorial_progress"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_tutorial_progress_user_id"),
        Index("idx_user_tutorial_progress_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, unique=True, index=True
    )
    current_step: Mapped[int] = mapped_column(
        default=0, comment="当前引导步骤（0 表示未开始）"
    )
    total_steps: Mapped[int] = mapped_column(
        default=5, comment="总步骤数"
    )
    completed: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="是否已完成全部引导"
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        UTCDateTime, nullable=True, comment="完成时间"
    )
    step_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True, comment="各步骤完成状态详情"
    )
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        default=datetime.now(timezone.utc),
        onupdate=datetime.now(timezone.utc),
    )
