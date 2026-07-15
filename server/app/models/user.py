"""用户模型。"""
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, DateTime, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class User(Base):
    """用户模型（支持微信登录和邮箱注册两种方式）。"""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    # 微信登录用户标识（邮箱注册用户为空）
    openid: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    # 邮箱注册用户标识（微信登录用户为空）
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # 邮箱验证码（临时字段，验证后清空）
    email_verify_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    email_verify_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    nickname: Mapped[Optional[str]] = mapped_column(String(100))
    avatar: Mapped[Optional[str]] = mapped_column(String(500))
    plan: Mapped[str] = mapped_column(String(20), default="free")
    plan_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # 关联
    projects: Mapped[List["Project"]] = relationship(back_populates="user")
    orders: Mapped[List["Order"]] = relationship(back_populates="user")
