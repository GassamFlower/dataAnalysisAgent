"""安全整改回归测试（后端安全审查后新增）。

覆盖整改清单中的代码级修复：
- 严重#1  ai_interpret 归属校验（IDOR）：非本人项目 404，且不消耗配额
- 严重#3  track_event 防伪造：已登录忽略客户端 user_id；匿名 user_id 为空
- 风险#4  支付回调金额核验：金额不符拒绝（防"改金额买高配"）
- 风险#8  Excel/CSV 公式注入：危险开头单元格被单引号转义
"""
import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import DEV_USER_ID
from app.models.analytics_event import AnalyticsEvent
from app.models.user import User
from app.services.quota_service import get_quota_status
from app.services.reporter import _safe_cell


async def _get_ai_interpret_quota() -> dict:
    """查询 dev 用户本周 ai_interpret 配额。"""
    async for db in get_db():
        status = await get_quota_status(db, DEV_USER_ID, "free")
        return status["quotas"]["ai_interpret"]
    return {}


async def _get_latest_event(event: str) -> AnalyticsEvent:
    """查询最新一条指定类型的埋点事件。"""
    async for db in get_db():
        result = await db.execute(
            select(AnalyticsEvent)
            .where(AnalyticsEvent.event_type == event)
            .order_by(AnalyticsEvent.created_at.desc())
        )
        return result.scalars().first()
    return None


# ---------------------------------------------------------------------------
# 严重#1  ai_interpret IDOR
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_ai_interpret_foreign_project_rejected_and_no_quota_consumed(
    client: AsyncClient,
):
    """非本人项目调用 ai-interpret → 404，且不消耗免费额度（归属校验先于扣额）。"""
    # 先把 dev 用户设为 free，验证"不消耗配额"
    async for db in get_db():
        user = await db.get(User, DEV_USER_ID)
        user.plan = "free"
        user.plan_expires_at = None
        await db.commit()
        break

    auth = await client.post("/api/v1/auth/dev-login")
    token = auth.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    before = await _get_ai_interpret_quota()

    # 一个不属于当前用户的随机 project_id
    foreign_project_id = uuid.uuid4()
    resp = await client.post(
        f"/api/v1/tutorial/ai-interpret/{foreign_project_id}",
        headers=headers,
        json={"question": "样本量是否足够", "section": "方法"},
    )
    assert resp.status_code == 404

    after = await _get_ai_interpret_quota()
    # 归属校验在扣额之前，故配额不应被消耗
    assert before["remaining"] == after["remaining"]


# ---------------------------------------------------------------------------
# 严重#3  track_event 防伪造
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_track_ignores_client_user_id_when_authenticated(
    client: AsyncClient,
):
    """已登录时客户端传入的 user_id 被忽略，改用 token 中的用户 ID。"""
    auth = await client.post("/api/v1/auth/dev-login")
    token = auth.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    spoofed_id = uuid.uuid4()  # 攻击者伪造的他人 user_id
    resp = await client.post(
        "/api/v1/analytics/track",
        headers=headers,
        json={
            "event": "project_create",
            "user_id": str(spoofed_id),
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
        },
    )
    assert resp.status_code == 200

    # 数据库中应存当前登录用户 ID，而非伪造 ID
    event = await _get_latest_event("project_create")
    assert event is not None
    assert str(event.user_id) == str(DEV_USER_ID)
    assert str(event.user_id) != str(spoofed_id)


@pytest.mark.anyio
async def test_track_anonymous_user_id_is_null(client: AsyncClient):
    """未登录埋点：user_id 为空，且不可归属到伪造项目。"""
    resp = await client.post(
        "/api/v1/analytics/track",
        json={
            "event": "register_page_view",
            "user_id": str(uuid.uuid4()),  # 匿名伪造 user_id
            "project_id": str(uuid.uuid4()),  # 匿名伪造 project_id
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
        },
    )
    assert resp.status_code == 200

    event = await _get_latest_event("register_page_view")
    assert event is not None
    assert event.user_id is None
    assert event.project_id is None  # 未登录不可归属项目


# ---------------------------------------------------------------------------
# 风险#4  支付回调金额核验
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_payment_notify_rejects_amount_mismatch(client: AsyncClient):
    """回调金额与订单金额不符 → 400，套餐不被激活。"""
    auth = await client.post("/api/v1/auth/dev-login")
    token = auth.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 创建 single 订单（金额 9.90）
    order_resp = await client.post(
        "/api/v1/payment/orders",
        headers=headers,
        json={"plan_type": "single"},
    )
    order_id = order_resp.json()["data"]["id"]

    # 回调携带错误金额（0.01），应被拒绝
    resp = await client.post(
        f"/api/v1/payment/orders/{order_id}/notify",
        json={
            "channel": "wechat",
            "transaction_id": f"wx-badamt-{uuid.uuid4().hex[:8]}",
            "status": "success",
            "amount": 0.01,
        },
    )
    assert resp.status_code == 400
    assert "金额" in resp.json().get("message", "")

    # 订单仍为 pending
    detail = await client.get(
        f"/api/v1/payment/orders/{order_id}",
        headers=headers,
    )
    assert detail.json()["data"]["status"] == "pending"


# ---------------------------------------------------------------------------
# 风险#8  公式注入转义
# ---------------------------------------------------------------------------


def test_safe_cell_escapes_formula_prefixes():
    """以 = + - @ tab CR 开头的字符串被前置单引号；数字/普通文本原样。"""
    assert _safe_cell("=cmd()") == "'=cmd()"
    assert _safe_cell("+SUM(A1)") == "'+SUM(A1)"
    assert _safe_cell("-1+1") == "'-1+1"
    assert _safe_cell("@SUM(A1)") == "'@SUM(A1)"
    assert _safe_cell("\t=evil") == "'\t=evil"
    assert _safe_cell("\r=evil") == "'\r=evil"
    # 正常内容不受影响
    assert _safe_cell("正常文本") == "正常文本"
    assert _safe_cell("") == ""
    assert _safe_cell("12.5") == "12.5"
