"""项目业务逻辑服务。

集中管理项目状态流转规则，禁止业务路由直接修改 `project.status`。
"""

from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

from app.core.exceptions import ValidationException
from app.models.project import Project


# 项目状态单向流转表：当前状态 → 允许的下一个状态
_ALLOWED_TRANSITIONS: Dict[str, Tuple[str, ...]] = {
    "draft": ("inspected",),
    "inspected": ("hypothesized",),
    "hypothesized": ("simulated",),
    "simulated": ("analyzed",),
}


def can_transition(from_status: str, to_status: str) -> bool:
    """判断状态流转是否合法。"""
    if from_status == to_status:
        return False
    return to_status in _ALLOWED_TRANSITIONS.get(from_status, ())


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

    if not can_transition(current, target_status):
        msg = (
            f"非法状态流转：{current} → {target_status}"
            if not reason
            else f"非法状态流转：{current} → {target_status}（{reason}）"
        )
        raise ValidationException(msg)

    project.status = target_status
    project.updated_at = datetime.now(timezone.utc)
    return project
