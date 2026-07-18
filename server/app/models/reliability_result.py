"""信效度结果模型。"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, Boolean, Numeric, ForeignKey, Index, UniqueConstraint, CheckConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.statistics_constants import grade_alpha, grade_bartlett, grade_kmo
from app.models import Base, UTCDateTime


class ReliabilityResult(Base):
    """各维度信效度结果。"""

    __tablename__ = "reliability_results"
    __table_args__ = (
        Index("idx_reliability_results_report_id", "report_id"),
        Index("idx_reliability_results_deleted_at", "deleted_at"),
        UniqueConstraint("report_id", "dimension"),
        CheckConstraint("passed IN (0, 1)", name="ck_reliability_results_passed"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    dimension: Mapped[str] = mapped_column(String(100), nullable=False)
    alpha: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    kmo: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    bartlett_p_value: Mapped[Decimal] = mapped_column(Numeric(12, 10), nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    # 关联
    report: Mapped["Report"] = relationship(back_populates="reliability_results")

    # ── 计算属性：分档等级与论文措辞（不落库，从存储值实时计算） ──
    # 设计依据：docs/后端架构设计文档.md 第 9.4 节
    # 阈值与分档来源：app/core/statistics_constants.py（唯一来源）

    @property
    def alpha_grade(self) -> str:
        return grade_alpha(float(self.alpha))[0]

    @property
    def alpha_wording(self) -> str:
        return grade_alpha(float(self.alpha))[1]

    @property
    def kmo_grade(self) -> str:
        return grade_kmo(float(self.kmo))[0]

    @property
    def kmo_wording(self) -> str:
        return grade_kmo(float(self.kmo))[1]

    @property
    def bartlett_grade(self) -> str:
        return grade_bartlett(float(self.bartlett_p_value))[0]

    @property
    def bartlett_wording(self) -> str:
        return grade_bartlett(float(self.bartlett_p_value))[1]
