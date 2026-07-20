"""用户用量模型。

按自然周统计免费用户的模拟生成/报告导出/高级统计调用次数。
付费用户（single/subscription）不限次数。
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime, Index, UniqueConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, UTCDateTime


class UserQuota(Base):
    """用户周用量记录。

    唯一约束：(user_id, action_type, period_key)
    每周一 00:00 UTC 自动重置（通过 period_key 区分周）。
    """

    __tablename__ = "user_quotas"
    __table_args__ = (
        UniqueConstraint("user_id", "action_type", "period_key", name="uq_user_quota_week"),
        Index("idx_user_quotas_user_period", "user_id", "period_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    period_key: Mapped[str] = mapped_column(String(20), nullable=False, comment="YYYY-Www 格式")
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    limit: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    reset_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )

    def __repr__(self):
        return f"<UserQuota(user={self.user_id}, action={self.action_type}, used={self.used_count}/{self.limit})>"
