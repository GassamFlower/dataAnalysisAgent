"""教程文章种子数据导入脚本。

用于将 Markdown 格式的教程内容导入数据库的 tutorial_articles 表。
运行方式：
    cd server
    python -m scripts.seed_tutorials
"""
import asyncio
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
TUTORIALS = [
    {
        "slug": "research-flow",
        "category": "basics",
        "title": "问卷研究的基本流程",
        "summary": "从明确研究问题到撰写结果，系统梳理问卷研究的完整流程。",
        "filename": "01-research-flow.md",
        "order_index": 10,
    },
    {
        "slug": "variable-types",
        "category": "basics",
        "title": "变量类型与测量尺度",
        "summary": "掌握定类、定序、定距、定比四种测量尺度，选对统计方法。",
        "filename": "02-variable-types.md",
        "order_index": 20,
    },
    {
        "slug": "cronbach-alpha",
        "category": "basics",
        "title": "信度分析：Cronbach's α",
        "summary": "学习 Cronbach's α 系数的含义、判断标准及处理方法。",
        "filename": "03-cronbach-alpha.md",
        "order_index": 30,
    },
    {
        "slug": "kmo-bartlett",
        "category": "basics",
        "title": "效度分析：KMO 与 Bartlett 检验",
        "summary": "了解结构效度分析的前置检验与因子分析基础。",
        "filename": "04-kmo-bartlett.md",
        "order_index": 40,
    },
    {
        "slug": "descriptive-statistics",
        "category": "basics",
        "title": "描述性统计与正态性检验",
        "summary": "均值、标准差、偏度、峰度与正态性检验方法详解。",
        "filename": "05-descriptive-statistics.md",
        "order_index": 50,
    },
    {
        "slug": "correlation-analysis",
        "category": "methods",
        "title": "相关分析",
        "summary": "学习 Pearson 相关分析、相关系数解读与常见误区。",
        "filename": "06-correlation-analysis.md",
        "order_index": 60,
    },
    {
        "slug": "difference-test",
        "category": "methods",
        "title": "差异检验：t 检验与方差分析",
        "summary": "掌握独立样本 t 检验、配对 t 检验和单因素方差分析。",
        "filename": "07-difference-test.md",
        "order_index": 70,
    },
    {
        "slug": "regression-analysis",
        "category": "methods",
        "title": "回归分析基础",
        "summary": "从简单线性回归到多元线性回归，学会解读 R² 与 β 系数。",
        "filename": "08-regression-analysis.md",
        "order_index": 80,
    },
    {
        "slug": "writing-results",
        "category": "writing",
        "title": "如何撰写数据分析结果",
        "summary": "结果部分的写作结构、规范句式与表格呈现技巧。",
        "filename": "09-writing-results.md",
        "order_index": 90,
    },
    {
        "slug": "statistical-reporting",
        "category": "writing",
        "title": "论文中常用的统计表述规范",
        "summary": "统计符号、小数位数、显著性表述与置信区间规范。",
        "filename": "10-statistical-reporting.md",
        "order_index": 100,
    },
]


def _extract_title(content: str) -> str:
    """从 Markdown 内容中提取一级标题作为标题。"""
    match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    return match.group(1).strip() if match else "未命名教程"


async def seed_tutorials(db: AsyncSession) -> None:
    """导入教程文章种子数据。"""
    now = datetime.now(timezone.utc)
    inserted = 0
    skipped = 0

    for meta in TUTORIALS:
        # 检查是否已存在
        result = await db.execute(
            select(TutorialArticle).where(
                TutorialArticle.slug == meta["slug"],
                TutorialArticle.deleted_at.is_(None),
            )
        )
        if result.scalar_one_or_none():
            print(f"[SKIP] 教程已存在: {meta['slug']}")
            skipped += 1
            continue

        # 读取 Markdown 内容
        file_path = CONTENT_DIR / meta["filename"]
        if not file_path.exists():
            print(f"[WARN] 文件不存在: {file_path}")
            continue

        content = file_path.read_text(encoding="utf-8")
        title = _extract_title(content) if not meta.get("title") else meta["title"]

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
            created_at=now,
            updated_at=now,
        )
        db.add(article)
        print(f"[INSERT] {meta['slug']}: {title}")
        inserted += 1

    await db.commit()
    print(f"\n完成：新增 {inserted} 篇，跳过 {skipped} 篇，总计 {len(TUTORIALS)} 篇。")


async def main() -> None:
    """脚本入口。"""
    if not CONTENT_DIR.exists():
        raise FileNotFoundError(f"教程内容目录不存在: {CONTENT_DIR}")

    async with async_session() as db:
        await seed_tutorials(db)


if __name__ == "__main__":
    asyncio.run(main())
