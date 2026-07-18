"""订单模型。"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, Numeric, ForeignKey, Index, CheckConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class Order(Base):
    """支付订单。"""

    __tablename__ = "orders"
    __table_args__ = (
        Index("idx_orders_user_id", "user_id"),
        Index("idx_orders_project_id", "project_id"),
        Index("idx_orders_status", "status"),
        Index("idx_orders_deleted_at", "deleted_at"),
        CheckConstraint("type IN ('single', 'subscription')", name="ck_orders_type"),
        CheckConstraint("amount >= 0", name="ck_orders_amount"),
        CheckConstraint(
            "status IN ('pending', 'paid', 'refunded', 'cancelled')",
            name="ck_orders_status",
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
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    provider_transaction_id: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)
    expires_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    user: Mapped["User"] = relationship(back_populates="orders")
    project: Mapped[Optional["Project"]] = relationship()
