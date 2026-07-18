"""报告模块测试（Round 3.2 验收）。

覆盖：
- 报告生成成功（真实统计 + R4 诊断）
- 付费守卫（free 用户 403）
- 项目状态守卫（非 simulated 返回 400）
- 数据集缺失（404）
- 查询最新报告
"""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_analyze_report_success(
    client: AsyncClient,
    paid_auth_headers: dict,
    simulated_project: dict,
    mock_diagnoser,
):
    """付费用户生成报告成功，返回真实信效度结果与诊断。"""
    project_id = simulated_project["id"]

    resp = await client.post(
        f"/api/v1/report/analyze/{project_id}",
        headers=paid_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]

    # 报告基础字段
    assert "id" in data
    assert data["project_id"] == project_id
    assert data["sample_size"] == 100
    assert data["total_count"] == 1

    # 信效度结果
    reliability = data["reliability_results"]
    assert len(reliability) == 1
    r = reliability[0]
    assert r["dimension"] == "学习动机"
    assert 0 <= r["alpha"] <= 1
    assert 0 <= r["kmo"] <= 1
    assert "alpha_grade" in r
    assert "kmo_grade" in r
    assert "bartlett_grade" in r

    # 诊断
    assert "diagnosis" in data
    assert isinstance(data["diagnosis"]["passed"], bool)
    assert "issues" in data["diagnosis"]


@pytest.mark.anyio
async def test_analyze_report_requires_paid_plan(
    client: AsyncClient,
    free_auth_headers: dict,
    simulated_project: dict,
):
    """free 用户调用 analyze 返回 403。"""
    resp = await client.post(
        f"/api/v1/report/analyze/{simulated_project['id']}",
        headers=free_auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_analyze_report_status_guard(
    client: AsyncClient,
    paid_auth_headers: dict,
    created_project: dict,
):
    """非 simulated 项目调用 analyze 返回 400。"""
    resp = await client.post(
        f"/api/v1/report/analyze/{created_project['id']}",
        headers=paid_auth_headers,
    )
    assert resp.status_code == 400
    assert "状态" in resp.json().get("message", "")


@pytest.mark.anyio
async def test_analyze_report_missing_dataset(
    client: AsyncClient,
    paid_auth_headers: dict,
    simulated_project_missing_dataset: dict,
):
    """simulated 状态但无数据集时返回 404。"""
    resp = await client.post(
        f"/api/v1/report/analyze/{simulated_project_missing_dataset['id']}",
        headers=paid_auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_get_report_success(
    client: AsyncClient,
    auth_headers: dict,
    paid_auth_headers: dict,
    simulated_project: dict,
    mock_diagnoser,
):
    """生成报告后可查询到最新报告。"""
    project_id = simulated_project["id"]

    # 先生成报告
    analyze_resp = await client.post(
        f"/api/v1/report/analyze/{project_id}",
        headers=paid_auth_headers,
    )
    assert analyze_resp.status_code == 200

    # 再查询
    get_resp = await client.get(
        f"/api/v1/report/{project_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 200
    data = get_resp.json()["data"]
    assert data["project_id"] == project_id
    assert len(data["reliability_results"]) == 1


@pytest.mark.anyio
async def test_get_report_not_found(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
):
    """未生成报告时查询返回 404。"""
    resp = await client.get(
        f"/api/v1/report/{created_project['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 404
