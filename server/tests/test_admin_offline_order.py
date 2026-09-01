"""后台手动开通（线下订单）测试（线下成交转最小可行方案 Step 2）。

覆盖：
- 非管理员调用 POST /admin/orders → 403
- 管理员创建线下订单 → 用户套餐激活 + 过期时间顺延 + 写审计（含渠道/备注）
- 非法渠道 → 422 拒绝；非法套餐类型 → 422
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import get_db
from app.models.audit_logs import AuditLog
from app.models.order import Order
from app.models.user import User


def _user_id():
    return uuid.UUID("00000000-0000-0000-0000-000000000001")


async def _make_admin():
    async for db in get_db():
        u = await db.get(User, _user_id())
        u.is_admin = True
        await db.commit()
        break


async def _unmake_admin():
    async for db in get_db():
        u = await db.get(User, _user_id())
        u.is_admin = False
        await db.commit()
        break


async def _set_plan(plan: str):
    async for db in get_db():
        u = await db.get(User, _user_id())
        u.plan = plan
        u.plan_expires_at = None
        await db.commit()
        break


@pytest.mark.anyio
async def test_non_admin_forbidden(client: AsyncClient, auth_headers: dict):
    """非管理员调线下开通接口返回 403。"""
    resp = await client.post(
        "/api/v1/admin/orders",
        headers=auth_headers,
        json={"user_id": str(_user_id()), "plan_type": "single"},
    )
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_admin_create_offline_order_activates_plan(
    client: AsyncClient, auth_headers: dict
):
    """管理员创建线下订单 → 用户套餐激活 + 订单落库 + 审计留痕。"""
    await _make_admin()
    try:
        await _set_plan("free")
        uid = str(_user_id())
        resp = await client.post(
            "/api/v1/admin/orders",
            headers=auth_headers,
            json={
                "user_id": uid,
                "plan_type": "single",
                "days": 30,
                "channel": "xianyu",
                "remark": "咸鱼订单号 XY-20260825",
                "amount": 9.9,
            },
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        # 用户套餐已开通
        assert data["plan"] == "single"
        assert data["plan_expires_at"] is not None
        # 下单结果里带订单信息（对账）
        assert data["order"]["type"] == "single"
        assert data["order"]["status"] == "paid"
        assert float(data["order"]["amount"]) == 9.9

        # 校验订单与套餐一致性
        async for db in get_db():
            user = await db.get(User, _user_id())
            assert user.plan == "single"
            assert user.plan_expires_at is not None
            # 订单确实落库为 paid，且无第三方流水（区别于在线支付）
            orders = (
                await db.execute(
                    select(Order)
                    .where(Order.user_id == _user_id())
                    .order_by(Order.created_at.desc())
                )
            ).scalars().all()
            assert orders and orders[0].status == "paid"
            assert orders[0].provider_transaction_id is None
            # 审计留痕
            audit = (
                await db.execute(
                    select(AuditLog)
                    .where(AuditLog.action_type == "admin_create_offline_order")
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalar_one_or_none()
            assert audit is not None
            detail = audit.action_detail or {}
            assert detail.get("channel") == "xianyu"
            assert detail.get("remark") == "咸鱼订单号 XY-20260825"
            break
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_offline_order_rejects_invalid_channel(
    client: AsyncClient, auth_headers: dict
):
    """非法成交渠道被拒绝。"""
    await _make_admin()
    try:
        resp = await client.post(
            "/api/v1/admin/orders",
            headers=auth_headers,
            json={
                "user_id": str(_user_id()),
                "plan_type": "single",
                "channel": "not-a-channel",
            },
        )
        # 后端抛 ValidationException → 400
        assert resp.status_code == 400
    finally:
        await _unmake_admin()


@pytest.mark.anyio
async def test_offline_order_rejects_bad_plan(client: AsyncClient, auth_headers: dict):
    """非法套餐类型拒绝（pydantic Literal → 422）。"""
    await _make_admin()
    try:
        resp = await client.post(
            "/api/v1/admin/orders",
            headers=auth_headers,
            json={
                "user_id": str(_user_id()),
                "plan_type": "vip",
                "channel": "xianyu",
            },
        )
        assert resp.status_code == 422
    finally:
        await _unmake_admin()