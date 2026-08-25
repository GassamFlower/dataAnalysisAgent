"""前端公开配置（Task 2.3）测试。

覆盖：GET /api/v1/frontend/config 匿名可访问，并返回客服微信号（原样暴露，供前端占位/真实号切换）。
"""
import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.anyio
async def test_frontend_config_public(client: AsyncClient):
    """匿名可访问前端公开配置，返回客服微信号字段。"""
    resp = await client.get("/api/v1/frontend/config")
    assert resp.status_code == 200
    data = resp.json()["data"]
    # 原样返回当前配置（留空即占位态；填入真实号则前端直接取用）
    assert "customer_service_wechat_id" in data
    assert data["customer_service_wechat_id"] == settings.CUSTOMER_SERVICE_WECHAT_ID