"""教程文章种子数据导入脚本。

用于将 Markdown 格式的教程内容导入数据库的 tutorial_articles 表。
运行方式：
    cd server
    python -m scripts.seed_tutorials
"""
import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models.tutorial_article import TutorialArticle


# 脚本所在目录
BASE_DIR = Path(__file__).parent
CONTENT_DIR = BASE_DIR / "tutorial_content"

# 教程元数据：文件名、slug、分类、排序
# 分类：basics（统计基础）、methods（分析方法）、writing（论文写作）
# 难度：beginner（入门）/ intermediate（进阶）……（写入 difficulty 字段）
TUTORIALS = [
    {
        "slug": "research-flow",
        "category": "basics",
        "title": "问卷研究的基本流程",
        "summary": "从明确研究问题到撰写结果，系统梳理问卷研究的完整流程。",
        "filename": "01-research-flow.md",
        "order_index": 10,
        "tags": ["流程", "入门"],
        "difficulty": "beginner",
    },
    {
        "slug": "variable-types",
        "category": "basics",
        "title": "变量类型与测量尺度",
        "summary": "掌握定类、定序、定距、定比四种测量尺度，选对统计方法。",
        "filename": "02-variable-types.md",
        "order_index": 20,
        "tags": ["变量", "入门"],
        "difficulty": "beginner",
    },
    {
        "slug": "cronbach-alpha",
        "category": "basics",
        "title": "信度分析：Cronbach's α",
        "summary": "学习 Cronbach's α 系数的含义、判断标准及处理方法。",
        "filename": "03-cronbach-alpha.md",
        "order_index": 30,
        "tags": ["信度", "效度"],
        "difficulty": "beginner",
    },
    {
        "slug": "kmo-bartlett",
        "category": "basics",
        "title": "效度分析：KMO 与 Bartlett 检验",
        "summary": "了解结构效度分析的前置检验与因子分析基础。",
        "filename": "04-kmo-bartlett.md",
        "order_index": 40,
        "tags": ["效度", "因子分析"],
        "difficulty": "beginner",
    },
    {
        "slug": "descriptive-statistics",
        "category": "basics",
        "title": "描述性统计与正态性检验",
        "summary": "均值、标准差、偏度、峰度与正态性检验方法详解。",
        "filename": "05-descriptive-statistics.md",
        "order_index": 50,
        "tags": ["描述统计", "正态"],
        "difficulty": "beginner",
    },
    {
        "slug": "correlation-analysis",
        "category": "methods",
        "title": "相关分析",
        "summary": "学习 Pearson 相关分析、相关系数解读与常见误区。",
        "filename": "06-correlation-analysis.md",
        "order_index": 60,
        "tags": ["相关"],
        "difficulty": "beginner",
    },
    {
        "slug": "difference-test",
        "category": "methods",
        "title": "差异检验：t 检验与方差分析",
        "summary": "掌握独立样本 t 检验、配对 t 检验和单因素方差分析。",
        "filename": "07-difference-test.md",
        "order_index": 70,
        "tags": ["差异检验", "t检验"],
        "difficulty": "beginner",
    },
    {
        "slug": "regression-analysis",
        "category": "methods",
        "title": "回归分析基础",
        "summary": "从简单线性回归到多元线性回归，学会解读 R² 与 β 系数。",
        "filename": "08-regression-analysis.md",
        "order_index": 80,
        "tags": ["回归"],
        "difficulty": "intermediate",
    },
    {
        "slug": "writing-results",
        "category": "writing",
        "title": "如何撰写数据分析结果",
        "summary": "结果部分的写作结构、规范句式与表格呈现技巧。",
        "filename": "09-writing-results.md",
        "order_index": 90,
        "tags": ["论文写作"],
        "difficulty": "beginner",
    },
    {
        "slug": "statistical-reporting",
        "category": "writing",
        "title": "论文中常用的统计表述规范",
        "summary": "统计符号、小数位数、显著性表述与置信区间规范。",
        "filename": "10-statistical-reporting.md",
        "order_index": 100,
        "tags": ["论文写作"],
        "difficulty": "beginner",
    },
    {
        "slug": "sample-size-power",
        "category": "basics",
        "title": "样本量与统计功效",
        "summary": "统计功效的概念、样本量估算方法及常见误区。",
        "filename": "11-sample-size-power.md",
        "order_index": 55,
        "tags": ["样本量", "功效"],
        "difficulty": "intermediate",
    },
    {
        "slug": "apa-format",
        "category": "writing",
        "title": "APA 格式速查",
        "summary": "统计符号、小数、显著性标注及常见统计结果的 APA 写法模板。",
        "filename": "12-apa-format.md",
        "order_index": 110,
        "tags": ["论文写作", "APA"],
        "difficulty": "beginner",
    },
    {
        "slug": "hypothesis-testing",
        "category": "basics",
        "title": "假设检验的基本原理",
        "summary": "理解原假设与备择假设、p 值与显著性水平、两类错误，掌握统计检验的核心逻辑。",
        "filename": "13-hypothesis-testing.md",
        "order_index": 15,
        "tags": ["假设检验"],
        "difficulty": "beginner",
    },
    {
        "slug": "data-cleaning",
        "category": "basics",
        "title": "数据清洗与预处理",
        "summary": "处理异常值、缺失值、重复数据并进行标准化，为可靠分析打好基础。",
        "filename": "14-data-cleaning.md",
        "order_index": 25,
        "tags": ["数据清洗"],
        "difficulty": "beginner",
    },
    {
        "slug": "chi-square-test",
        "category": "methods",
        "title": "卡方检验",
        "summary": "分析分类变量之间的关联，掌握卡方独立性检验、列联表与自由度。",
        "filename": "15-chi-square-test.md",
        "order_index": 75,
        "tags": ["卡方检验"],
        "difficulty": "intermediate",
    },
    {
        "slug": "nonparametric-test",
        "category": "methods",
        "title": "非参数检验",
        "summary": "数据不满足正态时使用曼-惠特尼 U 检验与克鲁斯卡尔-沃利斯检验。",
        "filename": "16-nonparametric-test.md",
        "order_index": 85,
        "tags": ["非参数检验"],
        "difficulty": "intermediate",
    },
    {
        "slug": "mediation-analysis",
        "category": "methods",
        "title": "中介效应分析",
        "summary": "揭示自变量影响因变量的内在机制，掌握因果步骤法与 Bootstrap 法。",
        "filename": "17-mediation-analysis.md",
        "order_index": 86,
        "tags": ["中介效应"],
        "difficulty": "advanced",
    },
    {
        "slug": "moderation-analysis",
        "category": "methods",
        "title": "调节效应分析",
        "summary": "检验自变量与因变量关系是否随第三个变量变化，掌握分层回归与简单斜率分析。",
        "filename": "18-moderation-analysis.md",
        "order_index": 87,
        "tags": ["调节效应"],
        "difficulty": "advanced",
    },
    {
        "slug": "factor-analysis",
        "category": "methods",
        "title": "探索性因子分析（EFA）",
        "summary": "识别测量变量背后的潜在结构，掌握因子载荷、特征值与旋转方法。",
        "filename": "19-factor-analysis.md",
        "order_index": 88,
        "tags": ["因子分析", "效度"],
        "difficulty": "intermediate",
    },
    {
        "slug": "effect-size",
        "category": "writing",
        "title": "效应量与统计功效",
        "summary": "量化结果的实际重要性，理解功效分析并正确报告效应量。",
        "filename": "20-effect-size.md",
        "order_index": 115,
        "tags": ["效应量", "功效"],
        "difficulty": "intermediate",
    },
    # ===== 2026-08 新增：高意图 SEO 长尾文（市场对标） =====
    {
        "slug": "merge-issue",
        "category": "basics",
        "title": "问卷信效度不达标怎么办",
        "summary": "Cronbach's α 过低、KMO 偏低、Bartlett 不显著时的系统排查与修改流程。",
        "filename": "21-merge-issue.md",
        "order_index": 45,
        "tags": ["信度", "效度", "答疑"],
        "difficulty": "beginner",
    },
    {
        "slug": "sample-size",
        "category": "basics",
        "title": "问卷样本量多少才够",
        "summary": "按题目数、分组、效应量与回收率，给出可直接套用的样本量估算方法。",
        "filename": "22-sample-size.md",
        "order_index": 56,
        "tags": ["样本量", "答疑"],
        "difficulty": "beginner",
    },
    {
        "slug": "dimension-splitting",
        "category": "basics",
        "title": "量表维度怎么划分才合理",
        "summary": "理论驱动 + 因子分析校验，把题目合理归入维度而不是硬凑。",
        "filename": "23-dimension-splitting.md",
        "order_index": 42,
        "tags": ["量表", "维度", "因子分析"],
        "difficulty": "intermediate",
    },
    {
        "slug": "not-significant",
        "category": "methods",
        "title": "统计结果不显著怎么办",
        "summary": "p > 0.05 的常见原因与补救：功效、异常值、反向题、效应量。",
        "filename": "24-not-significant.md",
        "order_index": 95,
        "tags": ["显著性", "答疑"],
        "difficulty": "beginner",
    },
    {
        "slug": "from-questionnaire-to-analysis",
        "category": "basics",
        "title": "问卷星回收后怎么开始分析",
        "summary": "从导出、清洗到体检、分析、报告的全流程清单。",
        "filename": "25-from-questionnaire-to-analysis.md",
        "order_index": 12,
        "tags": ["问卷星", "流程"],
        "difficulty": "beginner",
    },
    {
        "slug": "independent-t-test",
        "category": "methods",
        "title": "独立样本 t 检验",
        "summary": "何时用、前提条件、怎么解读、论文怎么写（含效应量报告）。",
        "filename": "26-independent-t-test.md",
        "order_index": 71,
        "tags": ["差异检验", "t检验"],
        "difficulty": "intermediate",
    },
    {
        "slug": "multiple-choice",
        "category": "methods",
        "title": "多选题数据怎么分析",
        "summary": "频数与个案百分比、多重响应交叉、占比报告。",
        "filename": "27-multiple-choice.md",
        "order_index": 52,
        "tags": ["多选题", "频数"],
        "difficulty": "beginner",
    },
    {
        "slug": "reporting-descriptives",
        "category": "writing",
        "title": "怎么在论文里规范描述统计结果",
        "summary": "描述性统计表三线表模板 + APA 撰写句式。",
        "filename": "28-reporting-descriptives.md",
        "order_index": 105,
        "tags": ["论文写作", "描述统计"],
        "difficulty": "beginner",
    },
]


def _extract_title(content: str) -> str:
    """从 Markdown 内容中提取一级标题作为标题。"""
    match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    return match.group(1).strip() if match else "未命名教程"


def _encode_tags(tags_raw) -> str:
    """将标签列表编码为 JSON 字符串；空/None 返回 None。"""
    if not tags_raw:
        return None
    cleaned = [str(t).strip() for t in tags_raw if str(t).strip()]
    if not cleaned:
        return None
    return json.dumps(cleaned, ensure_ascii=False)


async def seed_tutorials(db: AsyncSession) -> None:
    """导入教程文章种子数据（新建 + 回填 tags/difficulty 元数据）。"""
    now = datetime.now(timezone.utc)
    inserted = 0
    updated = 0

    for meta in TUTORIALS:
        # 读取 Markdown 内容
        file_path = CONTENT_DIR / meta["filename"]
        if not file_path.exists():
            print(f"[WARN] 文件不存在: {file_path}")
            continue

        content = file_path.read_text(encoding="utf-8")
        title = _extract_title(content) if not meta.get("title") else meta["title"]

        result = await db.execute(
            select(TutorialArticle).where(
                TutorialArticle.slug == meta["slug"],
                TutorialArticle.deleted_at.is_(None),
            )
        )
        existing = result.scalar_one_or_none()

        tags_json = _encode_tags(meta.get("tags"))
        difficulty = meta.get("difficulty")

        if existing:
            # 已存在：回填新的元数据字段（不改正文/标题）
            changed = False
            if existing.tags != tags_json:
                existing.tags = tags_json
                changed = True
            if existing.difficulty != difficulty:
                existing.difficulty = difficulty
                changed = True
            if changed:
                existing.updated_at = now
                updated += 1
                print(f"[UPDATE] {meta['slug']}: 回填 tags/difficulty")
            else:
                print(f"[SKIP] 教程已存在: {meta['slug']}")
            continue

        article = TutorialArticle(
            id=uuid.uuid4(),
            slug=meta["slug"],
            title=title,
            category=meta["category"],
            content_markdown=content,
            summary=meta.get("summary"),
            cover_image=None,
            order_index=meta["order_index"],
            is_published=True,
            tags=tags_json,
            difficulty=difficulty,
            created_at=now,
            updated_at=now,
        )
        db.add(article)
        print(f"[INSERT] {meta['slug']}: {title}")
        inserted += 1

    await db.commit()
    print(
        f"\n完成：新增 {inserted} 篇，回填 {updated} 篇，跳过其余，总计 {len(TUTORIALS)} 篇。"
    )


async def main() -> None:
    """脚本入口。"""
    if not CONTENT_DIR.exists():
        raise FileNotFoundError(f"教程内容目录不存在: {CONTENT_DIR}")

    async with async_session() as db:
        await seed_tutorials(db)


if __name__ == "__main__":
    asyncio.run(main())