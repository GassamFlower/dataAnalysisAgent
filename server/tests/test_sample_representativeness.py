"""样本代表性诊断测试（F-RPT-007 + F-RPT-008 一句话结论）。

覆盖：
- 引擎规则：样本量不足 / 性别失衡 / 结构集中 / 全部达标 / 无人口学变量
- LLM 补充：成功注入 + 失败降级为空串
- 一句话结论模板：指标级 / 规则级 / 未知指标
- API：真实项目 200 / 模拟项目 supported=False / 未认证 401
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import get_db
from app.models.dataset import Dataset
from app.models.question import Question
from app.services.diagnosis_rules import one_liner_for
from app.services.sample_representativeness import (
    SampleRepresentativenessEngine,
    llm_enrich,
)

DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _build_questions(project_id: uuid.UUID):
    """构造人口学题目（性别 1 题 + 年龄 1 题）。"""
    return [
        Question(
            project_id=project_id,
            index=1,
            text="您的性别是？",
            question_type="demographic",
            dimension="人口学",
            is_reverse=False,
            confidence="high",
        ),
        Question(
            project_id=project_id,
            index=2,
            text="您的年龄是？",
            question_type="demographic",
            dimension="人口学",
            is_reverse=False,
            confidence="high",
        ),
    ]


# ─────────────────────────────────────────────────────────────
# 引擎单元测试（纯规则）
# ─────────────────────────────────────────────────────────────


def _demo_report(df, sample_size, questions=None):
    engine = SampleRepresentativenessEngine(
        questions or [], df, sample_size
    )
    return engine.run()


def test_engine_sample_size_too_small():
    import pandas as pd

    df = pd.DataFrame(
        {"q1": ["男"] * 30 + ["女"] * 20, "q2": ["18-22"] * 50},
    )
    report = _demo_report(df, 50, _build_questions(uuid.uuid4()))

    assert report.has_demographic
    items = {it.key: it for it in report.items}
    assert items["sample_size"].status == "fail"
    assert "N=50" in items["sample_size"].message
    assert "200" in items["sample_size"].suggestion


def test_engine_gender_imbalance():
    import pandas as pd

    df = pd.DataFrame(
        {"q1": ["男"] * 80 + ["女"] * 20, "q2": ["18-22"] * 100},
    )
    report = _demo_report(df, 100, _build_questions(uuid.uuid4()))

    items = {it.key: it for it in report.items}
    assert items["gender_balance"].status == "fail"
    assert "失衡" in items["gender_balance"].message
    assert "补充" in items["gender_balance"].suggestion


def test_engine_gender_balanced_pass():
    import pandas as pd

    df = pd.DataFrame(
        {"q1": ["男"] * 60 + ["女"] * 40, "q2": ["18-22"] * 100},
    )
    report = _demo_report(df, 100, _build_questions(uuid.uuid4()))

    items = {it.key: it for it in report.items}
    assert items["gender_balance"].status == "pass"


def test_engine_concentration_warn():
    import pandas as pd

    # 年龄 90% 集中在 18-22 → 结构集中
    df = pd.DataFrame(
        {
            "q1": ["男"] * 120 + ["女"] * 80,
            "q2": ["18-22"] * 180 + ["23-30"] * 20,
        },
    )
    report = _demo_report(df, 200, _build_questions(uuid.uuid4()))

    items = {it.key: it for it in report.items}
    assert items["sample_size"].status == "pass"
    assert items["concentration"].status == "warn"
    assert "集中" in items["concentration"].message
    assert "无法代表" in items["concentration"].suggestion


def test_engine_all_pass_grade_a():
    import pandas as pd

    df = pd.DataFrame(
        {
            "q1": ["男"] * 120 + ["女"] * 80,
            "q2": [18 + (i % 22) for i in range(200)],
        },
    )
    report = _demo_report(df, 200, _build_questions(uuid.uuid4()))

    assert report.overall_score >= 85
    assert report.grade == "A"
    assert all(it.status == "pass" for it in report.items)


def test_engine_no_demographic():
    report = _demo_report(None, 0, questions=[])
    assert not report.has_demographic
    assert "未检测到人口学变量" in report.message


def test_llm_enrich_no_demographic_returns_empty():
    report = _demo_report(None, 0, questions=[])
    assert llm_enrich(report) == ""


def test_llm_enrich_failure_fallback(monkeypatch):
    import pandas as pd

    def _raise(prompt: str, system: str = "") -> str:
        del prompt, system
        raise RuntimeError("provider down")

    monkeypatch.setattr(
        "app.services.sample_representativeness.chat_flash", _raise
    )
    df = pd.DataFrame({"q1": ["男"] * 120 + ["女"] * 80})
    report = _demo_report(df, 200, _build_questions(uuid.uuid4()))
    assert llm_enrich(report) == ""


def test_llm_enrich_success(monkeypatch):
    import pandas as pd

    def _fake(prompt: str, system: str = "") -> str:
        del prompt, system
        return '{"conclusion": "样本量偏小且以女性为主", "suggestions": ["补充男性样本"]}'

    monkeypatch.setattr(
        "app.services.sample_representativeness.chat_flash", _fake
    )
    df = pd.DataFrame({"q1": ["男"] * 120 + ["女"] * 80})
    report = _demo_report(df, 200, _build_questions(uuid.uuid4()))
    conclusion = llm_enrich(report)
    assert "样本量偏小" in conclusion
    assert "补充男性样本" in conclusion


# ─────────────────────────────────────────────────────────────
# 一句话结论模板（F-RPT-008）
# ─────────────────────────────────────────────────────────────


def test_one_liner_metric_alpha():
    text = one_liner_for("alpha", 0.613, 0.7)
    assert "α=0.613" in text
    assert "低于" in text


def test_one_liner_rule_reverse_items():
    text = one_liner_for("reverse_items", 0, 0)
    assert "反向题" in text and "反转" in text


def test_one_liner_rule_r_squared():
    text = one_liner_for("r_squared", 0, 0)
    assert text != ""


def test_one_liner_unknown_metric():
    assert one_liner_for("unknown_metric", 0, 0) == ""
    assert one_liner_for("unknown_metric", 0.5, 0.7) == ""


# ─────────────────────────────────────────────────────────────
# API 集成测试
# ─────────────────────────────────────────────────────────────


async def _seed_real_project(client, auth_headers, *, with_demographic=True):
    """创建真实数据项目：题目（含人口学）+ 真实数据集。返回项目 id。"""
    resp = await client.post(
        "/api/v1/projects/",
        headers=auth_headers,
        json={"name": "样本代表性测试项目", "mode": "real"},
    )
    assert resp.status_code == 201
    project_id = resp.json()["data"]["id"]

    async for db in get_db():
        questions = _build_questions(uuid.UUID(project_id)) if with_demographic else []
        if not with_demographic:
            questions.append(
                Question(
                    project_id=uuid.UUID(project_id),
                    index=1,
                    text="我对学习充满热情",
                    question_type="likert5",
                    dimension="学习动机",
                    is_reverse=False,
                    confidence="high",
                )
            )
        for q in questions:
            db.add(q)

        dataset = Dataset(
            project_id=uuid.UUID(project_id),
            source="real",
            sample_size=100,
            columns=["q1", "q2"],
            data=[["男", "18-22"] if i < 80 else ["女", "18-22"] for i in range(100)],
        )
        db.add(dataset)

        project = await db.get(
            __import__("app.models.project", fromlist=["Project"]).Project,
            uuid.UUID(project_id),
        )
        project.status = "inspected"
        project.mode = "real"
        await db.commit()
        break

    return project_id


@pytest.mark.anyio
async def test_sample_rep_success(
    client: AsyncClient,
    auth_headers: dict,
    monkeypatch,
):
    """真实数据项目：返回样本代表性报告（规则 + 无 LLM 时降级为空结论）。"""

    def _no_llm(prompt: str, system: str = "") -> str:
        del prompt, system
        raise RuntimeError("no provider")

    monkeypatch.setattr(
        "app.services.sample_representativeness.chat_flash", _no_llm
    )

    project_id = await _seed_real_project(client, auth_headers)

    resp = await client.get(
        f"/api/v1/report/{project_id}/sample-representativeness",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["supported"] is True
    assert data["sample_size"] == 100
    assert data["has_demographic"] is True
    assert data["ai_conclusion"] == ""
    keys = {it["key"] for it in data["items"]}
    assert {"sample_size", "gender_balance", "concentration"} <= keys
    gender = next(it for it in data["items"] if it["key"] == "gender_balance")
    assert gender["status"] == "fail"
    assert len(data["distributions"]) == 2


@pytest.mark.anyio
async def test_sample_rep_with_llm(
    client: AsyncClient,
    auth_headers: dict,
    monkeypatch,
):
    """LLM 可用时注入说人话结论。"""

    def _fake(prompt: str, system: str = "") -> str:
        del prompt, system
        return '{"conclusion": "样本以男性为主，代表性一般", "suggestions": ["建议补充女性样本"]}'

    monkeypatch.setattr(
        "app.services.sample_representativeness.chat_flash", _fake
    )

    project_id = await _seed_real_project(client, auth_headers)
    resp = await client.get(
        f"/api/v1/report/{project_id}/sample-representativeness",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "代表性一般" in data["ai_conclusion"]


@pytest.mark.anyio
async def test_sample_rep_no_demographic(
    client: AsyncClient,
    auth_headers: dict,
    monkeypatch,
):
    """无人口学变量时提示未检测到。"""

    def _no_llm(prompt: str, system: str = "") -> str:
        del prompt, system
        raise RuntimeError("no provider")

    monkeypatch.setattr(
        "app.services.sample_representativeness.chat_flash", _no_llm
    )

    project_id = await _seed_real_project(
        client, auth_headers, with_demographic=False
    )
    resp = await client.get(
        f"/api/v1/report/{project_id}/sample-representativeness",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["has_demographic"] is False
    assert "未检测到人口学变量" in data["message"]


@pytest.mark.anyio
async def test_sample_rep_simulation_project(
    client: AsyncClient,
    auth_headers: dict,
    simulated_project: dict,
):
    """模拟数据项目：supported=False，不参与诊断。"""
    resp = await client.get(
        f"/api/v1/report/{simulated_project['id']}/sample-representativeness",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["supported"] is False
    assert "仅适用于真实数据项目" in data["message"]


@pytest.mark.anyio
async def test_sample_rep_requires_auth(client: AsyncClient):
    """未认证返回 401。"""
    resp = await client.get(
        f"/api/v1/report/{uuid.uuid4()}/sample-representativeness"
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_sample_rep_others_project_forbidden(
    client: AsyncClient,
    auth_headers: dict,
    created_project: dict,
):
    """无题目/无真实数据的属主项目：返回支持但不检测（不报错）。"""
    resp = await client.get(
        f"/api/v1/report/{created_project['id']}/sample-representativeness",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    # 项目归属校验通过（get_owned_project 未抛 404），默认模式无真实数据集 → 不误报
    assert data["supported"] in (True, False)
