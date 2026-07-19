"""LLM 配置模型。

存储 LLM 模型配置，支持通过数据库动态切换模型，
fallback 到环境变量配置。
"""
from datetime import datetime, timezone

from sqlalchemy import String, Text, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class LlmConfig(Base):
    """LLM 配置表。

    通过 key-value 存储 LLM 相关配置，支持运行时动态切换。
    未配置的项 fallback 到环境变量。

    预设配置键：
    - llm.preferred_provider: 优先使用的 provider（deepseek/kimi/qwen）
    - llm.flash_model: R1-R3 使用的模型名称
    - llm.pro_model: R4 使用的模型名称
    """

    __tablename__ = "llm_configs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    config_value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True, default="")
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self):
        return f"<LlmConfig(key={self.config_key}, value={self.config_value})>"
