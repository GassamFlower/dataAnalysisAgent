"""运行时应用配置模型（key-value）。

存储可在管理后台运行时调整的运营参数（当前用于免费配额限制）。
未配置的键回落到各自默认值（服务端常量 / 环境变量），与 llm_configs 的
「配置优先、env 兜底」模式一致。

设计说明：
- 仅存放「可在后台调整、且运行时实时生效」的可调旋钮，不替代 env 敏感项。
- 单一来源：`app.services.admin_config_service` 负责默认值声明与读写封装，
  业务侧（如 quota_service）只调用该服务的 `get_quota_limits()`，不在别处硬编码。
"""
from datetime import datetime, timezone

from sqlalchemy import String, Text, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class AppConfig(Base):
    """后台可调配置项。"""

    __tablename__ = "app_configs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    config_value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True, default="")
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_by: Mapped[str] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self):
        return f"<AppConfig(key={self.config_key}, value={self.config_value})>"