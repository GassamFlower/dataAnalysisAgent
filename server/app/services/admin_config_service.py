"""后台可调配置服务层（F-ADM-003 增强：运行时配额配置）。

提供「免费配额各动作周上限」的默认值与 DB 覆盖读取。业务方（如
quota_service）只调用本模块的接口获取有效值，不在别处硬编码。

- 默认值：`DEFAULT_QUOTA_LIMITS`（与 quota_service 既有 FREE_LIMITS 对齐）。
- 覆盖：管理后台写入 app_configs 表的 `quota.<action>` 键后生效。
- 没有覆盖时返回默认值；覆盖值非法（负数/非数字）时回落到默认值。
"""
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_config import AppConfig

logger = logging.getLogger(__name__)

# 免费额度配置（每周）——运行时默认值。与 quota_service.FREE_LIMITS 对齐。
DEFAULT_QUOTA_LIMITS: dict[str, int] = {
    "simulation": 6,
    "export": 6,
    "analysis": 6,
    "data_import": 6,
    "ai_interpret": 1,
}

# 每个动作的可读中文标签
QUOTA_ACTION_LABELS: dict[str, str] = {
    "simulation": "模拟预演",
    "export": "报告导出",
    "analysis": "高级统计",
    "data_import": "数据导入",
    "ai_interpret": "AI 解读",
}

_CONFIG_KEY_PREFIX = "quota."


def _key(action: str) -> str:
    return f"{_CONFIG_KEY_PREFIX}{action}"


def _parse_int(raw: str, default: int) -> int:
    try:
        v = int(float(str(raw).strip()))
        return v if v >= 0 else default
    except (ValueError, TypeError):
        return default


async def get_quota_limits(db: AsyncSession) -> dict[str, int]:
    """返回各动作类型的有效周配额（DB 覆盖优先，否则默认值）。"""
    if not DEFAULT_QUOTA_LIMITS:
        return {}
    res = await db.execute(
        select(AppConfig.config_key, AppConfig.config_value).where(
            AppConfig.config_key.in_([_key(a) for a in DEFAULT_QUOTA_LIMITS]),
            AppConfig.is_enabled.is_(True),
        )
    )
    overrides = dict(res.all())
    limits = {}
    for action, default in DEFAULT_QUOTA_LIMITS.items():
        raw = overrides.get(_key(action))
        limits[action] = _parse_int(raw, default) if raw is not None else default
    return limits


async def upsert_quota_limits(
    db: AsyncSession, action: str, value: int, *, updated_by: str = ""
) -> bool:
    """写入某个动作的配额上限。value 合法（>=0）才更新，否则返回 False。"""
    if action not in DEFAULT_QUOTA_LIMITS:
        return False
    try:
        v = int(value)
        if v < 0:
            return False
    except (TypeError, ValueError):
        return False

    k = _key(action)
    res = await db.execute(select(AppConfig).where(AppConfig.config_key == k))
    row = res.scalar_one_or_none()
    if row:
        row.config_value = str(v)
        row.is_enabled = True
        if updated_by:
            row.updated_by = updated_by
    else:
        db.add(
            AppConfig(
                config_key=k,
                config_value=str(v),
                description=f"免费配额-{QUOTA_ACTION_LABELS.get(action, action)}（每周）",
                is_enabled=True,
                updated_by=updated_by,
            )
        )
    return True


def quota_limits_effective(action: str, db_limits: dict[str, int] | None) -> int:
    """给定某动作的 DB 覆盖值（可为整 dict 或单值），返回最终生效值。"""
    if db_limits is None:
        return DEFAULT_QUOTA_LIMITS.get(action, 1)
    return db_limits.get(action, DEFAULT_QUOTA_LIMITS.get(action, 1))