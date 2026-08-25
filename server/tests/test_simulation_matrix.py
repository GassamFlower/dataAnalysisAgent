"""模拟矩阵预演命中率传导测试（S1-3：预演→报告）。

覆盖：GET /simulation/{project_id} 在项目已生成预演且存在假设路径时，
复算并返回预设命中率（供报告页标注达标情况与失效假设）。
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import get_db
from app.models.hypothesis import Hypothesis
from app.models.hypothesis_path import HypothesisPath


@pytest.mark.anyio
async def test_get_simulation_returns_hit_rate_after_generated(
    client: AsyncClient, auth_headers: dict, simulated_project: dict
):
    """已生成预演 + 有假设路径时，GET 返回命中率汇总。"""
    project_id = uuid.UUID(simulated_project["id"])

    # 给项目补两条假设路径（命中率复算的数据源）
    async for db in get_db():
        hypothesis = Hypothesis(project_id=project_id, raw_text="测试假设")
        db.add(hypothesis)
        await db.flush()
        db.add(HypothesisPath(
            hypothesis_id=hypothesis.id,
            predictor="学习动机", outcome="学业成绩",
            direction="positive", strength="strong",
        ))
        db.add(HypothesisPath(
            hypothesis_id=hypothesis.id,
            predictor="焦虑", outcome="学业成绩",
            direction="negative", strength="weak",
        ))
        await db.commit()
        break

    resp = await client.get(
        f"/api/v1/simulation/{simulated_project['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["paths"]  # 假设路径已回传
    hr = data["hit_rate"]
    assert hr is not None
    assert hr["total_count"] == 2
    assert 0.0 <= hr["overall"] <= 1.0
    assert len(hr["paths"]) == 2
    # 每条路径带命中率与达标标记（fixture 样本量为 100）
    for item in hr["paths"]:
        assert 0.0 <= item["hit_rate"] <= 1.0
        assert item["passed"] in (True, False)
        assert item["sample_size"] == 100


@pytest.mark.anyio
async def test_get_simulation_no_hit_rate_without_config(
    client: AsyncClient, auth_headers: dict, created_project: dict
):
    """未生成过预演（无 SimulationConfig）时，命中率为 null。"""
    resp = await client.get(
        f"/api/v1/simulation/{created_project['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["hit_rate"] is None