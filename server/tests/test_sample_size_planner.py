"""样本量规划引擎测试（F-RPT-008）。

覆盖：
- 公式闭式解对照已知值：相关（r=0.1/0.3/0.5）、t 检验（d=0.5/0.8）、回归（10×k 法则）
- 参数校验：r/d/predictors 非法值、未知分析类型、alpha/power 越界
- build_plan：推荐目标 = max(公式, 代表性下限)、verdict 判定（sufficient/marginal/insufficient）
- 引导文案：不足时显式声明「不提供样本收集/投放服务」
- API：未认证 401 / 用户手填效应量 / 模拟项目自动取矩阵效应量 / 无矩阵默认中等效应 /
        t 检验默认 d / 回归自变量个数
"""

import uuid
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import get_db
from app.core.statistics_constants import PLANNER_MIN_TARGET
from app.models.correlation_matrix import CorrelationMatrix
from app.services.sample_size_planner import (
    HIT_RATE_TARGET,
    analyze_hypothesis_power,
    build_plan,
    correlation_power,
    required_n_correlation,
    required_n_regression,
    required_n_t_test,
)


# ─────────────────────────────────────────────────────────────
# 公式闭式解（对照 G*Power 公开经验值）
# ─────────────────────────────────────────────────────────────


def test_correlation_r_03_requires_85():
    # r=0.3, α=0.05, power=0.8 → N≈85（Fisher z 变换）
    assert required_n_correlation(0.3) == 85


def test_correlation_r_05_requires_30():
    # r=0.5 → N≈30
    assert required_n_correlation(0.5) == 30


def test_correlation_r_01_requires_783():
    # r=0.1（小效应）→ N≈783
    assert required_n_correlation(0.1) == 783


def test_correlation_alpha_power_affects_n():
    assert required_n_correlation(0.3, alpha=0.01, power=0.9) > required_n_correlation(0.3)


def test_correlation_negative_r_uses_abs():
    assert required_n_correlation(-0.3) == required_n_correlation(0.3)


def test_correlation_invalid_r():
    with pytest.raises(ValueError):
        required_n_correlation(0.0)
    with pytest.raises(ValueError):
        required_n_correlation(1.0)
    with pytest.raises(ValueError):
        required_n_correlation(-1.5)


def test_t_test_d_05_per_group_63():
    # d=0.5, α=0.05, power=0.8 → 每组 n≈63，总 N≈126
    assert required_n_t_test(0.5) == 63


def test_t_test_d_08_per_group_25():
    # d=0.8（大效应）→ 每组 n≈25
    assert required_n_t_test(0.8) == 25


def test_t_test_invalid_d():
    with pytest.raises(ValueError):
        required_n_t_test(0.0)
    with pytest.raises(ValueError):
        required_n_t_test(-0.3)


def test_regression_rule():
    assert required_n_regression(1) == 30  # 下限 30
    assert required_n_regression(3) == 30
    assert required_n_regression(5) == 50
    assert required_n_regression(10) == 100


def test_regression_invalid_predictors():
    with pytest.raises(ValueError):
        required_n_regression(0)


# ─────────────────────────────────────────────────────────────
# build_plan 综合
# ─────────────────────────────────────────────────────────────


def test_plan_correlation_sufficient():
    plan = build_plan("correlation", 0.3, 0.05, 0.8, planned_n=300)
    assert plan["required_n"] == 85
    assert plan["recommended_n"] == PLANNER_MIN_TARGET
    assert plan["verdict"] == "sufficient"
    assert plan["shortfall"] == 0
    assert plan["one_liner"]
    assert "可以开始回收" in plan["guidance"][-1]


def test_plan_correlation_marginal():
    # 功效够（85≤100）但低于代表性下限 200 → marginal
    plan = build_plan("correlation", 0.3, 0.05, 0.8, planned_n=100)
    assert plan["verdict"] == "marginal"
    assert "低于代表性建议下限" in plan["guidance"][-1]


def test_plan_correlation_insufficient_shortfall():
    plan = build_plan("correlation", 0.3, 0.05, 0.8, planned_n=50)
    assert plan["verdict"] == "insufficient"
    assert plan["shortfall"] == PLANNER_MIN_TARGET - 50
    assert "不提供样本收集/投放服务" in plan["guidance"][-1]


def test_plan_t_test_total_and_per_group():
    plan = build_plan("t_test", 0.5, 0.05, 0.8, planned_n=None)
    assert plan["per_group_n"] == 63
    assert plan["required_n"] == 126
    assert plan["recommended_n"] == PLANNER_MIN_TARGET
    assert plan["verdict"] == "unknown"


def test_plan_regression_uses_predictors():
    plan = build_plan("regression", 0.3, 0.05, 0.8, predictors=5, planned_n=80)
    assert plan["required_n"] == 50
    assert plan["effect_label"].startswith("k=5")
    assert plan["verdict"] == "marginal"


def test_plan_effect_source_label():
    plan = build_plan("correlation", 0.4, 0.05, 0.8, effect_source="simulation")
    assert plan["effect_source"] == "simulation"
    assert any(g in plan["effect_label"] for g in ("大", "中", "小", "可忽略"))


def test_plan_invalid_inputs():
    with pytest.raises(ValueError):
        build_plan("unknown_type", 0.3, 0.05, 0.8)
    with pytest.raises(ValueError):
        build_plan("correlation", 0.3, 0.0, 0.8)
    with pytest.raises(ValueError):
        build_plan("correlation", 0.3, 0.05, 1.0)
    with pytest.raises(ValueError):
        build_plan("t_test", 0.0, 0.05, 0.8)
    with pytest.raises(ValueError):
        build_plan("regression", 0.3, 0.05, 0.8)


# ─────────────────────────────────────────────────────────────
# API 集成测试
# ─────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_planner_requires_auth(client: AsyncClient):
    resp = await client.post(
        f"/api/v1/report/{uuid.uuid4()}/sample-size-planner",
        json={"analysis_type": "correlation"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_planner_user_effect_size(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
):
    """用户手填效应量 r=0.5 → required_n=30，effect_source=user。"""
    resp = await client.post(
        f"/api/v1/report/{created_project['id']}/sample-size-planner",
        headers=auth_headers,
        json={"analysis_type": "correlation", "effect_size": 0.5},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["effect_source"] == "user"
    assert data["effect_size"] == 0.5
    assert data["required_n"] == 30
    assert data["recommended_n"] == PLANNER_MIN_TARGET


@pytest.mark.anyio
async def test_planner_simulation_default_medium(
    client: AsyncClient,
    auth_headers: dict,
    simulated_project: dict,
):
    """模拟项目无矩阵 → 默认中等效应 r=0.3 → required_n=85。"""
    resp = await client.post(
        f"/api/v1/report/{simulated_project['id']}/sample-size-planner",
        headers=auth_headers,
        json={"analysis_type": "correlation"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["effect_source"] == "default"
    assert data["effect_size"] == pytest.approx(0.3, abs=0.001)
    assert data["required_n"] == 85


@pytest.mark.anyio
async def test_planner_simulation_from_matrix(
    client: AsyncClient,
    auth_headers: dict,
    simulated_project: dict,
):
    """模拟项目已有矩阵 → 自动取非对角线最大相关 r=0.6。"""
    project_id = uuid.UUID(simulated_project["id"])
    async for db in get_db():
        db.add(
            CorrelationMatrix(
                project_id=project_id,
                dimensions=["学习动机", "学业成绩", "家庭支持"],
                cells=[
                    [
                        {"row": "学习动机", "col": "学习动机", "value": 0.0, "source": "system"},
                        {"row": "学习动机", "col": "学业成绩", "value": 0.6, "source": "user"},
                        {"row": "学习动机", "col": "家庭支持", "value": 0.2, "source": "system"},
                    ],
                    [
                        {"row": "学业成绩", "col": "学习动机", "value": 0.6, "source": "user"},
                        {"row": "学业成绩", "col": "学业成绩", "value": 0.0, "source": "system"},
                        {"row": "学业成绩", "col": "家庭支持", "value": 0.1, "source": "system"},
                    ],
                    [
                        {"row": "家庭支持", "col": "学习动机", "value": 0.2, "source": "system"},
                        {"row": "家庭支持", "col": "学业成绩", "value": 0.1, "source": "system"},
                        {"row": "家庭支持", "col": "家庭支持", "value": 0.0, "source": "system"},
                    ],
                ],
            )
        )
        await db.commit()
        break

    resp = await client.post(
        f"/api/v1/report/{simulated_project['id']}/sample-size-planner",
        headers=auth_headers,
        json={"analysis_type": "correlation"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["effect_source"] == "simulation"
    assert data["effect_size"] == pytest.approx(0.6, abs=0.001)
    assert data["required_n"] == 20


@pytest.mark.anyio
async def test_planner_t_test_default_d(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
):
    """t 检验未填效应量 → 默认中等 d=0.5 → 每组 63，总数 126。"""
    resp = await client.post(
        f"/api/v1/report/{created_project['id']}/sample-size-planner",
        headers=auth_headers,
        json={"analysis_type": "t_test"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["effect_source"] == "default"
    assert data["effect_size"] == pytest.approx(0.5, abs=0.001)
    assert data["per_group_n"] == 63
    assert data["required_n"] == 126


@pytest.mark.anyio
async def test_planner_regression_predictors_from_matrix(
    client: AsyncClient,
    auth_headers: dict,
    simulated_project: dict,
):
    """回归分析：自变量个数取自矩阵维度（3 维 → k=2 → N=30 下限）。"""
    project_id = uuid.UUID(simulated_project["id"])
    async for db in get_db():
        db.add(
            CorrelationMatrix(
                project_id=project_id,
                dimensions=["学习动机", "学业成绩", "家庭支持"],
                cells=[],
            )
        )
        await db.commit()
        break

    resp = await client.post(
        f"/api/v1/report/{simulated_project['id']}/sample-size-planner",
        headers=auth_headers,
        json={"analysis_type": "regression", "planned_n": 45},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["required_n"] == 30
    assert data["verdict"] == "marginal"


@pytest.mark.anyio
async def test_planner_validation_error(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
):
    """非法效应量 r=1.5 → 服务层拒绝 → 400。"""
    resp = await client.post(
        f"/api/v1/report/{created_project['id']}/sample-size-planner",
        headers=auth_headers,
        json={"analysis_type": "correlation", "effect_size": 1.5},
    )
    assert resp.status_code == 400
    assert resp.json()["message"]


# ─────────────────────────────────────────────────────────────
# 预演命中率：correlation_power / analyze_hypothesis_power
# ─────────────────────────────────────────────────────────────


def _path(predictor, outcome, direction="positive", strength="medium"):
    return SimpleNamespace(
        predictor=predictor,
        outcome=outcome,
        direction=direction,
        strength=strength,
    )


def test_correlation_power_equals_required_n_inverse():
    # 逆运算：r=0.3 在 required_n=85 下功效应回到 ≈0.8（与规划器同一闭式解）
    for r, n in [(0.3, 85), (0.5, 30), (0.1, 783)]:
        power = correlation_power(r, n)
        assert abs(power - 0.80) < 0.05, f"r={r}, n={n} → {power}"


def test_correlation_power_increases_with_effect_and_n():
    # 效应量越大、样本量越大，功效越高
    assert correlation_power(0.4, 100) > correlation_power(0.3, 100)
    assert correlation_power(0.4, 200) > correlation_power(0.4, 100) > 0.05


def test_correlation_power_boundaries():
    assert correlation_power(0.0, 200) == 0.0
    assert correlation_power(0.3, 3) == 0.0  # 样本量过小
    assert correlation_power(0.99, 200) == 1.0
    assert correlation_power(-0.3, 85) == correlation_power(0.3, 85)


def test_analyze_hypothesis_power_fallback_strength():
    # 无矩阵时按强度档位名义 r（weak=0.2/medium=0.4/strong=0.6）
    paths = [
        _path("A", "B", strength="strong"),
        _path("C", "D", strength="weak"),
    ]
    res = analyze_hypothesis_power(paths, sample_size=100)
    assert res["total_count"] == 2
    # strong(0.6) 必然命中，weak(0.2) 在 n=100 下命中率较低
    hit = {p["predictor"]: p for p in res["paths"]}
    assert hit["A"]["effect_size_r"] == 0.6
    assert hit["C"]["effect_size_r"] == 0.2
    assert hit["A"]["hit_rate"] > hit["C"]["hit_rate"]
    assert res["overall"] == round(res["passed_count"] / 2, 3)


def test_analyze_hypothesis_power_custom_cells_override():
    # 用户矩阵值覆盖档位名义值（权威生效值）
    cells = [[{"row": "A", "col": "B", "value": 0.8}]]
    paths = [_path("A", "B", strength="weak")]  # 名义 0.2，被矩阵 0.8 覆盖
    res = analyze_hypothesis_power(paths, sample_size=80, custom_cells=cells)
    item = res["paths"][0]
    assert item["effect_size_r"] == 0.8
    assert item["passed"] is True
    assert item["target"] == HIT_RATE_TARGET


def test_analyze_hypothesis_power_zero_cell_fails():
    # 矩阵值 0 → 功效为 0，视为不达标
    cells = [[{"row": "A", "col": "B", "value": 0.0}]]
    paths = [_path("A", "B")]
    res = analyze_hypothesis_power(paths, sample_size=100, custom_cells=cells)
    assert res["paths"][0]["hit_rate"] == 0.0
    assert res["paths"][0]["passed"] is False
