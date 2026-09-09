"""管理后台服务层（bootstrap 晋升 + 授权模型 + 运营查询辅助）。"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Sequence, Set

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.admin_permission import AdminPermission
from app.models.project import Project
from app.models.user import User

logger = logging.getLogger(__name__)

# 合法套餐枚举（与 users 表 ck_users_plan 一致）
VALID_PLANS = {"free", "single", "subscription"}


# ── 后台模块定义（F-ADM-001 授权模型）───────────────────────────────────


class ADMIN_MODULES:
    """后台可授予子管理员的模块清单。

    - 超管拥有全部模块，不需要授权记录。
    - 子管理员仅能访问被授予且未过期的模块。
    """

    USERS = "users"          # 用户与项目运营：列表/详情/改套餐/禁用/线下开通/导出
    ORDERS = "orders"         # 订单与支付管理
    MESSAGES = "messages"     # 留言管理
    CONFIGS = "configs"       # 配置与配额
    AUDIT = "audit"           # 审计日志


# 全部可授予模块（用于接口约束与校验）
ALL_ADMIN_MODULES: Set[str] = {
    ADMIN_MODULES.USERS,
    ADMIN_MODULES.ORDERS,
    ADMIN_MODULES.MESSAGES,
    ADMIN_MODULES.CONFIGS,
    ADMIN_MODULES.AUDIT,
}

# 模块的人类可读标签
ADMIN_MODULE_LABELS: dict[str, str] = {
    ADMIN_MODULES.USERS: "用户与项目运营",
    ADMIN_MODULES.ORDERS: "订单与支付管理",
    ADMIN_MODULES.MESSAGES: "留言管理",
    ADMIN_MODULES.CONFIGS: "配置与规则",
    ADMIN_MODULES.AUDIT: "审计日志",
}

# 角色模板：一键批量授予常用工位所需模块（前端据此勾选，超管可再调整后提交）
# key = 角色标识，value = (角色名称, [模块集合])
ADMIN_ROLE_TEMPLATES: dict[str, tuple[str, list[str]]] = {
    "customer_service": (
        "客服岗",
        [
            ADMIN_MODULES.USERS,
            ADMIN_MODULES.ORDERS,
            ADMIN_MODULES.MESSAGES,
        ],
    ),
    "ops": ("运营岗", [ADMIN_MODULES.USERS, ADMIN_MODULES.ORDERS]),
    "finance": ("财务岗", [ADMIN_MODULES.ORDERS]),
    "content": ("内容/规则岗", [ADMIN_MODULES.MESSAGES, ADMIN_MODULES.CONFIGS]),
}


def role_template_list() -> list[dict]:
    """返回可用的角色模板目录（供前端下拉）。

    每个元素含：key、name（角色名）、modules(模块标识)、
    modules_label（带标签的展示串）。
    """
    return [
        {
            "key": key,
            "name": name,
            "modules": modules,
            "modules_label": [ADMIN_MODULE_LABELS.get(m, m) for m in modules],
        }
        for key, (name, modules) in ADMIN_ROLE_TEMPLATES.items()
    ]


# ── 授权存取 ─────────────────────────────────────────────────────────────


def is_granted_active(perm: AdminPermission, now: Optional[datetime] = None) -> bool:
    """模块授权是否仍有效：expires_at 为空 = 长期有效；否则需晚于当前时刻。"""
    if perm.expires_at is None:
        return True
    now = now or datetime.now(timezone.utc)
    return perm.expires_at > now


async def get_user_modules(
    db: AsyncSession, user: User, now: Optional[datetime] = None
) -> Set[str]:
    """返回该用户实际可访问的后台模块集合。

    - 超管：返回全部模块（无需授权记录）。
    - 普通管理员（is_admin 但没有任何模块授权记录，即历史 bootstrap/整体管理员）：
      保持兼容，视为拥有全部模块（don't 回退/锁死旧管理员）。
    - 受限子管理员（被超管在 admin_permissions 中授予了模块）：仅返回已授权且未过期的模块。
    - 普通用户：空集。
    """
    if not user.is_admin:
        return set()
    if user.is_super_admin:
        return set(ALL_ADMIN_MODULES)
    res = await db.execute(
        select(AdminPermission).where(AdminPermission.user_id == user.id)
    )
    perms = res.scalars().all()
    if not perms:
        # 历史管理员：只有 is_admin 而无任何授权记录 → 拥有全部模块
        return set(ALL_ADMIN_MODULES)
    now = now or datetime.now(timezone.utc)
    return {
        p.module
        for p in perms
        if p.module in ALL_ADMIN_MODULES and is_granted_active(p, now)
    }


# ── bootstrap：初始管理员晋升（立项 G1）───────────────────────────────


async def promote_emails(
    db: AsyncSession, emails: Sequence[str], as_super_admin: bool = False
) -> dict:
    """将指定邮箱对应的账号晋升为管理员（is_admin=True）。

    as_super_admin=True 时额外置 is_super_admin=True，用于首个超管的引导。
    - 幂等安全：对已是超管的账号不会降级，对 is_super_admin=True 的账号求晋升为
      普通管理员也会保留其超管身份（只升不降）。
    - 只晋升已存在的、非软删的用户；不存在则跳过并记录。
    返回 {promoted: [...], not_found: [...], already: int, made_super: [...]}。
    """
    promoted, not_found, already, made_super = [], [], 0, []
    for raw in emails:
        email = (raw or "").strip().lower()
        if not email:
            continue
        res = await db.execute(select(User).where(func.lower(User.email) == email))
        user = res.scalar_one_or_none()
        if not user:
            not_found.append(email)
            continue
        if user.is_admin and not as_super_admin:
            already += 1
            continue
        if user.is_admin and as_super_admin and user.is_super_admin:
            already += 1
            continue
        user.is_admin = True
        if as_super_admin and not user.is_super_admin:
            user.is_super_admin = True
            made_super.append(email)
        promoted.append(email)
    await db.commit()
    logger.info(
        "ADMIN bootstrap: promoted=%s made_super=%s not_found=%s already=%d",
        promoted, made_super, not_found, already,
    )
    return {
        "promoted": promoted,
        "made_super_admin": made_super,
        "not_found": not_found,
        "already": already,
    }


async def promote_configured_emails(db: AsyncSession) -> None:
    """启动阶段：按配置自动晋升初始管理员与首个超管。

    - settings.ADMIN_EMAILS：晋升为普通管理员（is_admin=True）。
    - settings.BOOTSTRAP_SUPER_ADMIN_EMAILS：晋升为超管（is_admin+is_super_admin=True），
      用于平台首个超管引导；幂等，不会夺取既有超管身份。
    """
    emails = [e.strip() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    if emails:
        await promote_emails(db, emails, as_super_admin=False)
    super_emails = [
        e.strip()
        for e in settings.BOOTSTRAP_SUPER_ADMIN_EMAILS.split(",")
        if e.strip()
    ]
    if super_emails:
        await promote_emails(db, super_emails, as_super_admin=True)


# ------------------------------------------------------------------------


def user_admin_dict(user: User) -> dict:
    """管理端用户序列化（含脱敏）。"""
    email = None
    if user.email:
        local, _, domain = user.email.partition("@")
        email = f"{local[:1]}***@{domain}" if len(local) > 2 else "***@" + domain
    return {
        "id": str(user.id),
        "email": user.email,
        "email_masked": email,
        "nickname": user.nickname,
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "is_admin": user.is_admin,
        "is_super_admin": user.is_super_admin,
        "email_verified": user.email_verified,
        "disabled": user.disabled_at is not None,
        "disabled_at": user.disabled_at.isoformat() if user.disabled_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


async def get_user_project_counts(
    db: AsyncSession, user_ids: List[str]
) -> dict:
    """一次查询多用户的未删除项目数。"""
    ids = [_uuid(u) for u in user_ids if _uuid(u)]
    if not ids:
        return {}
    res = await db.execute(
        select(Project.user_id, func.count(Project.id))
        .where(Project.user_id.in_(ids), Project.deleted_at.is_(None))
        .group_by(Project.user_id)
    )
    return {str(uid): cnt for uid, cnt in res.all()}


def _uuid(v: str):
    try:
        return uuid.UUID(str(v))
    except ValueError:
        return None