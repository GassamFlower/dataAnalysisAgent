"""用户协议同意记录模型。"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Index, UniqueConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, UTCDateTime


class UserAgreement(Base):
    """用户协议同意记录（合规 F-SYS-005/006）。"""

    __tablename__ = "user_agreements"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "agreement_type", "agreement_version",
            name="uq_user_agreement_version"
        ),
        Index("idx_user_agreements_user_id", "user_id"),
        Index("idx_user_agreements_type", "agreement_type"),
        Index("idx_user_agreements_agreed_at", "agreed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, index=True
    )
    agreement_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    agreement_version: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    agreed_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), index=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
