"""用户模型。"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import String, Boolean, Index, CheckConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, UTCDateTime


class User(Base):
    """用户模型（支持微信登录和邮箱注册两种方式）。"""

    __tablename__ = "users"
    __table_args__ = (
        Index("idx_users_openid", "openid"),
        Index("idx_users_email", "email"),
        Index("idx_users_deleted_at", "deleted_at"),
        CheckConstraint("email_verified IN (0, 1)", name="ck_users_email_verified"),
        CheckConstraint("is_admin IN (0, 1)", name="ck_users_is_admin"),
        CheckConstraint("plan IN ('free', 'single', 'subscription')", name="ck_users_plan"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    # 微信登录用户标识（邮箱注册用户为空）
    openid: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    # 邮箱注册用户标识（微信登录用户为空）
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # 邮箱验证码哈希（临时字段，验证后清空；禁止明文存储）
    email_verify_code_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_verify_expires_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    nickname: Mapped[Optional[str]] = mapped_column(String(100))
    avatar: Mapped[Optional[str]] = mapped_column(String(500))
    plan: Mapped[str] = mapped_column(String(20), default="free")
    plan_expires_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    refresh_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # 合规字段（F-SYS-005）
    agreed_terms_version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    agreed_terms_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    projects: Mapped[List["Project"]] = relationship(back_populates="user")
    orders: Mapped[List["Order"]] = relationship(back_populates="user")
