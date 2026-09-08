"""后台管理员子模块授权模型（模块级管理权限）。"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Uuid, String, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, UTCDateTime


class AdminPermission(Base):
    """子管理员被授权的后台模块。

    说明：
    - 超管（users.is_super_admin=True）拥有所有模块，不需要本表记录。
    - 子管理员（is_admin=True 且 is_super_admin=False）仅能访问本表列出的模块。
    - module 取值见 admin_service.ADMIN_MODULES。
    - expires_at：该模块授权的到期时间。为 None 表示永久有效；
      早于当前时间则该模块授权视为失效（require_module 会拒绝）。
    """

    __tablename__ = "admin_permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "module", name="uq_admin_perm_user_module"),
        Index("idx_admin_permissions_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    # 授权有效期：None=长期有效；否则到期后该模块授权自动失效
    expires_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime, nullable=True)
