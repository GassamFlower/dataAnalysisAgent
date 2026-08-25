"""留言（售后）模型。

设计说明（3NF 评审）：
- 1NF：无重复列组，留言内容独立成行。
- 2NF：tag / content / contact 等字段仅依赖主键 id，与项目无关。
- 3NF：tag、data_source、status 均以稳定 ASCII 枚举码存储（0 冗余），
  中文标签由 schema 侧 label 映射统一给出，避免重复文案存库。
- 反规范化：无；关联用户与项目各以 FK 表达。
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, ForeignKey, Index, CheckConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime

# 五类留言 tag（立项文档 §4.3：售前 / 救急 / 服务 / 故障 / 反馈）
TAG_CHOICES = ("presale", "rescue", "service", "incident", "feedback")
# 数据源类型（真实/模拟）
DATA_SOURCE_CHOICES = ("real", "simulation")
# 处理状态
STATUS_CHOICES = ("pending", "processing", "done")


class Message(Base):
    """售后留言。"""

    __tablename__ = "messages"
    __table_args__ = (
        Index("idx_messages_user_id", "user_id"),
        Index("idx_messages_project_id", "project_id"),
        Index("idx_messages_tag", "tag"),
        Index("idx_messages_status", "status"),
        Index("idx_messages_deleted_at", "deleted_at"),
        CheckConstraint(
            "tag IN ('presale', 'rescue', 'service', 'incident', 'feedback')",
            name="ck_messages_tag",
        ),
        CheckConstraint(
            "data_source IN ('real', 'simulation') OR data_source IS NULL",
            name="ck_messages_data_source",
        ),
        CheckConstraint(
            "status IN ('pending', 'processing', 'done')",
            name="ck_messages_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="SET NULL")
    )
    tag: Mapped[str] = mapped_column(String(20), nullable=False)
    data_source: Mapped[Optional[str]] = mapped_column(String(20))
    entry_point: Mapped[Optional[str]] = mapped_column(String(40))
    contact: Mapped[Optional[str]] = mapped_column(String(120))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    handled_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    handled_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)
    handle_remark: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc),
        onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    project: Mapped[Optional["Project"]] = relationship()
    handled_admin: Mapped[Optional["User"]] = relationship(
        foreign_keys=[handled_by]
    )