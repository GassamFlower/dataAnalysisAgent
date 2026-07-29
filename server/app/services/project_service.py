"""项目业务逻辑服务。

集中管理项目状态流转规则，禁止业务路由直接修改 `project.status`。
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException
from app.models.project import Project


# 项目状态单向流转表：当前状态 → 允许的下一个状态
# 真实数据项目可跳过 simulated，直接从 inspected → analyzed
_ALLOWED_TRANSITIONS: Dict[str, Tuple[str, ...]] = {
    "draft": ("inspected",),
    "inspected": ("hypothesized", "analyzed"),
    "hypothesized": ("simulated",),
    "simulated": ("analyzed",),
}


def can_transition(from_status: str, to_status: str, project_mode: str = "simulation") -> bool:
    """判断状态流转是否合法。

    Args:
        from_status: 当前状态
        to_status: 目标状态
        project_mode: 项目模式（real / simulation），真实数据项目允许 inspected → analyzed
    """
    if from_status == to_status:
        return False
    allowed = _ALLOWED_TRANSITIONS.get(from_status, ())
    if to_status in allowed:
        # inspected → analyzed 仅在真实数据项目中允许
        if from_status == "inspected" and to_status == "analyzed":
            return project_mode == "real"
        return True
    return False


async def get_owned_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Project:
    """查询当前用户拥有的、未删除的项目。

    所有按 project_id 操作的业务路由都应调用此函数，以统一实现：
    1. 项目存在性校验；2. 用户归属校验；3. 软删除过滤。
    """
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == user_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")
    return project


def update_project_status(
    project: Project,
    target_status: str,
    *,
    reason: Optional[str] = None,
) -> Project:
    """以安全方式更新项目状态。

    Args:
        project: 项目 ORM 对象
        target_status: 目标状态
        reason: 可选的流转原因，用于日志或错误信息

    Returns:
        更新后的 project 对象（尚未 commit，由调用方决定 flush/commit 时机）

    Raises:
        ValidationException: 非法的状态流转
    """
    current = project.status
    if current == target_status:
        # 状态一致时不报错，仅刷新 updated_at
        project.updated_at = datetime.now(timezone.utc)
        return project

    if not can_transition(current, target_status, project.mode):
        msg = (
            f"非法状态流转：{current} → {target_status}"
            if not reason
            else f"非法状态流转：{current} → {target_status}（{reason}）"
        )
        raise ValidationException(msg)

    project.status = target_status
    project.updated_at = datetime.now(timezone.utc)
    return project
