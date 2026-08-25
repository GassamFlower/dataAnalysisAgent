"""学科量表库检索接口测试（Task 4.1）。

验证：公开列表/学科筛选/关键词搜索/详情（含维度与条目）/404。

说明：测试库（data_analysis_agent.db）为共享文件库，量表数据会跨用例/跨运行累积，
因此**不依赖精确数量**断言，改为校验各学科种子 slug 均存在。
"""
import uuid

import pytest

from app.core.database import get_db
from app.services.scale_service import ScaleService
from scripts.seed_scales import seed_scales
from app.models.research_scale import ResearchScale, ScaleDimension, ScaleItem

# 各学科种子 slug（seed_scales.py 中定义的公开量表）
SEED_SLUGS = {
    "management": ["job-satisfaction-jds", "organizational-commitment", "leadership-tlq"],
    "education": ["learning-motivation-el", "academic-self-efficacy", "teaching-quality-satisfaction"],
    "psychology": ["self-esteem-rses", "life-satisfaction-swls", "perceived-stress-pss"],
}


@pytest.fixture
async def seeded_scales(client):
    """向测试库写入量表种子数据。

    依赖 client（其 setup 已调用 init_db 建表），确保 seed 时表已存在。
    """
    async for db in get_db():
        await seed_scales(db)
        break


async def _insert_scale():
    """直接插入一条精简量表（含维度与条目，验证详情结构）。

    slug 使用随机后缀，避免共享测试库中跨运行重复插入触发唯一约束。
    """
    slug = f"custom-test-scale-{uuid.uuid4().hex[:8]}"
    async for db in get_db():
        scale = ResearchScale(
            slug=slug,
            name="测试量表",
            discipline="management",
            description="用于接口测试",
            scoring_method="Likert 五点量表",
            source="测试来源",
            reliability_ref="测试信度引用",
            validity_ref="测试效度引用",
            is_published=True,
        )
        db.add(scale)
        await db.flush()
        dim = ScaleDimension(scale_id=scale.id, index=1, name="维度A")
        db.add(dim)
        await db.flush()
        db.add(ScaleItem(dimension_id=dim.id, index=1, text="反向题示例", is_reverse=True))
        db.add(ScaleItem(dimension_id=dim.id, index=2, text="正向题示例", is_reverse=False))
        await db.commit()
        break
    return slug


@pytest.mark.anyio
async def test_list_scales_public(seeded_scales, client):
    resp = await client.get("/api/v1/scales")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] >= 9  # 管理/教育/心理各 3 条
    assert data["page"] == 1
    # 列表项含来源与信效度引用
    first = data["items"][0]
    assert "id" in first and "slug" in first and "name" in first
    assert "source" in first and "reliability_ref" in first and "validity_ref" in first


@pytest.mark.anyio
async def test_list_scales_filter_by_discipline(seeded_scales, client):
    for discipline in ("management", "education", "psychology"):
        resp = await client.get("/api/v1/scales", params={"discipline": discipline})
        assert resp.status_code == 200
        data = resp.json()["data"]
        slugs = {i["slug"] for i in data["items"]}
        assert set(SEED_SLUGS[discipline]) <= slugs, f"{discipline} 应包含种子 slug"
        assert all(i["discipline"] == discipline for i in data["items"])


@pytest.mark.anyio
async def test_list_scales_keyword_search(seeded_scales, client):
    resp = await client.get("/api/v1/scales", params={"keyword": "满意度"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] >= 1
    assert all("满意度" in (i["name"] or "") or "满意度" in (i["description"] or "") for i in data["items"])


@pytest.mark.anyio
async def test_get_scale_detail(seeded_scales, client):
    resp = await client.get("/api/v1/scales/job-satisfaction-jds")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["slug"] == "job-satisfaction-jds"
    assert data["discipline"] == "management"
    assert data["scoring_method"]
    assert len(data["dimensions"]) >= 1
    total_items = sum(len(d["items"]) for d in data["dimensions"])
    assert total_items >= 1
    # 维度条目含反向标记字段
    assert all("is_reverse" in it for d in data["dimensions"] for it in d["items"])


@pytest.mark.anyio
async def test_get_scale_detail_custom(seeded_scales, client):
    slug = await _insert_scale()
    resp = await client.get(f"/api/v1/scales/{slug}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["source"] == "测试来源"
    assert data["reliability_ref"] == "测试信度引用"
    assert data["validity_ref"] == "测试效度引用"
    assert [d["name"] for d in data["dimensions"]] == ["维度A"]
    items = data["dimensions"][0]["items"]
    assert {i["text"]: i["is_reverse"] for i in items} == {"反向题示例": True, "正向题示例": False}


@pytest.mark.anyio
async def test_get_scale_not_found(client):
    resp = await client.get("/api/v1/scales/not-exist-scale")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_scale_service_list_via_service(seeded_scales):
    """验证 service 层直接返回正确结构（证据补充）。"""
    async for db in get_db():
        result = await ScaleService.list_scales(db, keyword="压力")
        assert result.total >= 1
        assert all("压力" in (i.name or "") or "压力" in (i.description or "") for i in result.items)
        break


async def _first_scale_id():
    """返回第一个种子的量表 id。"""
    from sqlalchemy import select
    from app.models.research_scale import ResearchScale
    async for db in get_db():
        result = await db.execute(
            select(ResearchScale).where(
                ResearchScale.is_published.is_(True),
                ResearchScale.deleted_at.is_(None),
            ).order_by(ResearchScale.discipline, ResearchScale.name).limit(1)
        )
        scale = result.scalar_one()
        return scale.id


# ========== Task 4.2 量表→预演联动 ==========

@pytest.mark.anyio
async def test_create_project_from_scale(seeded_scales, client, auth_headers):
    """选量表一键建项目：题目/维度/反向题正确落库，可直接进入预演。"""
    scale_id = await _first_scale_id()
    # 用 project 建项目
    resp = await client.post(
        "/api/v1/projects/",
        headers=auth_headers,
        json={"name": "量表驱动项目", "scale_id": str(scale_id)},
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["mode"] == "simulation"
    assert data["status"] == "inspected"
    assert data["overview"]["question_count"] >= 1
    assert data["overview"]["dimension_count"] >= 1
    assert data["overview"]["dataset"]["source"] == "scale"

    # 题目真实落库（JSON 序列化后 id 为字符串，需转回 UUID 才能与 Uuid 列比较）
    from sqlalchemy import select
    from app.models.question import Question
    project_id = uuid.UUID(data["id"])
    async for db in get_db():
        qs = (
            await db.execute(
                select(Question).where(Question.project_id == project_id)
            )
        ).scalars().all()
        assert len(qs) == data["overview"]["question_count"]
        # 索引唯一且从 1 递增
        assert [q.index for q in qs] == list(range(1, len(qs) + 1))
        dimensions = {q.dimension for q in qs}
        assert len(dimensions) == data["overview"]["dimension_count"]
        break


@pytest.mark.anyio
async def test_create_project_from_invalid_scale(seeded_scales, client, auth_headers):
    """不存在的 scale_id 应返回 404。"""
    import uuid
    resp = await client.post(
        "/api/v1/projects/",
        headers=auth_headers,
        json={"name": "无效量表项目", "scale_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 404