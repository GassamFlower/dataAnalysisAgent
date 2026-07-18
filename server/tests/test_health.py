"""健康检查接口测试。"""
import pytest


@pytest.mark.anyio
async def test_health_check(client):
    """测试健康检查接口。"""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["message"] == "success"
    assert data["data"]["status"] == "ok"
    assert data["data"]["service"] == "data-analysis-agent"
