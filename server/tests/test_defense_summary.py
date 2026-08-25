"""模拟答辩摘要测试（S1-2）。

覆盖：
- generate_path_qa / assemble_defense_summary（确定性逐路径答辩问答）
- self_check_defense（合规红线自检：禁止语义结论断言）
- /simulation/{project_id}/defense-summary 端点
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import get_db
from app.models.hypothesis import Hypothesis
from app.models.hypothesis_path import HypothesisPath
from app.services.report_polisher import (
    assemble_defense_summary,
    generate_path_qa,
    self_check_defense,
)


def _item(
    predictor="学习动机",
    outcome="学业成绩",
    direction="positive",
    strength="strong",
    r=0.6,
    n=50,
    hit=0.95,
    passed=True,
):
    return {
        "predictor": predictor,
        "outcome": outcome,
        "direction": direction,
        "strength": strength,
        "effect_size_r": r,
        "sample_size": n,
        "hit_rate": hit,
        "target": 0.7,
        "passed": passed,
    }


def test_generate_path_qa_passed():
    qa = generate_path_qa(_item(hit=0.95, passed=True), required_n=30)
    assert "学习动机" in qa["question"]
    assert "把握度" in qa["answer"]
    assert "已超过目标" in qa["answer"]


def test_generate_path_qa_not_passed_links_sample_size():
    # 未达标：应引用目标样本量建议（required_n）
    qa = generate_path_qa(_item(r=0.15, n=50, hit=0.35, passed=False), required_n=274)
    assert "低于目标" in qa["answer"]
    assert "提升到约 274" in qa["answer"]


def test_assemble_defense_summary_counts_and_text():
    paths = [
        _item(predictor="学习动机", outcome="成绩", r=0.6, hit=0.95, passed=True),
        _item(predictor="焦虑", outcome="成绩", direction="negative",
              strength="weak", r=0.15, hit=0.35, passed=False),
    ]
    summary = assemble_defense_summary(paths, overall=0.5)
    assert summary["passed_count"] == 1
    assert summary["total_count"] == 2
    assert summary["overall"] == 0.5
    assert len(summary["items"]) == 2
    assert "本次预演共 2 条假设路径" in summary["text"]
    # 含立法声明，且合规自检通过
    assert "非研究结论" in summary["text"]
    assert self_check_defense(summary["text"])["passed"] is True


def test_assemble_defense_summary_empty():
    summary = assemble_defense_summary([], overall=0.0)
    assert summary["items"] == []
    assert "非研究结论" in summary["text"]
    assert self_check_defense(summary["text"])["passed"] is True


def test_self_check_defense_detects_forbidden():
    bad = "预演显示该处理显著提升了学习动机，证明假设成立"
    check = self_check_defense(bad)
    assert check["passed"] is False
    assert check["words"]  # 至少命中「显著提升」


def test_self_check_defense_clean_text():
    clean = "预演统计范式描述，仅报告效应量与命中率，不含结论"
    check = self_check_defense(clean)
    assert check["passed"] is True
    assert check["warnings"] == []


@pytest.mark.anyio
async def test_defense_summary_endpoint(client: AsyncClient, auth_headers: dict, simulated_project: dict):
    """已生成预演的模拟项目，可生成答辩摘要。"""
    project_id = uuid.UUID(simulated_project["id"])

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

    resp = await client.post(
        f"/api/v1/simulation/{simulated_project['id']}/defense-summary",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_count"] == 2
    assert len(data["items"]) == 2
    assert data["sample_size"] == 100
    assert "非研究结论" in data["disclaimer"]
    # 合规：整体文本不得含语义结论断言
    assert self_check_defense(data["text"])["passed"] is True
    for item in data["items"]:
        assert item["question"]
        assert item["answer"]


@pytest.mark.anyio
async def test_defense_summary_requires_generated_data(client: AsyncClient, auth_headers: dict, created_project: dict):
    """尚未生成预演的项目，接口应明确拒绝。"""
    resp = await client.post(
        f"/api/v1/simulation/{created_project['id']}/defense-summary",
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "请你先创建假设" in resp.json()["message"] or "请先" in resp.json()["message"]