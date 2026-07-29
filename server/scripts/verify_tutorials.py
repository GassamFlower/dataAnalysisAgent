"""验证教程模块 API 数据一致性。

直接调用 Service 层检查列表与详情接口，无需启动 HTTP 服务。
运行方式：
    cd server
    python -m scripts.verify_tutorials
"""
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.services.tutorial_service import TutorialService


async def verify(db: AsyncSession) -> None:
    """验证教程列表与详情。"""
    print("=== 验证教程列表 ===")
    list_result = await TutorialService.list_articles(
        db=db,
        category=None,
        keyword=None,
        page=1,
        page_size=24,
        include_unpublished=False,
    )
    print(f"总计: {list_result.total} 篇")
    print(f"本页: {len(list_result.items)} 篇")

    for item in list_result.items:
        print(f"  - [{item.category}] {item.title} ({item.slug})")

    assert list_result.total == 10, f"期望 10 篇教程，实际 {list_result.total} 篇"

    print("\n=== 验证分类筛选 ===")
    basics_result = await TutorialService.list_articles(
        db=db,
        category="basics",
        keyword=None,
        page=1,
        page_size=24,
        include_unpublished=False,
    )
    print(f"统计基础类: {basics_result.total} 篇")
    assert basics_result.total == 5, f"期望 5 篇统计基础教程，实际 {basics_result.total} 篇"

    print("\n=== 验证关键词搜索 ===")
    search_result = await TutorialService.list_articles(
        db=db,
        category=None,
        keyword="回归",
        page=1,
        page_size=24,
        include_unpublished=False,
    )
    print(f"搜索'回归': {search_result.total} 篇")
    assert search_result.total >= 1, "期望至少 1 篇包含'回归'的教程"

    print("\n=== 验证详情查询 ===")
    article = await TutorialService.get_article_by_slug(
        db, "cronbach-alpha", include_unpublished=False
    )
    assert article is not None, "cronbach-alpha 教程应存在"
    print(f"详情: {article.title}")
    assert "Cronbach" in article.content_markdown, "详情内容应包含 Cronbach 关键字"

    print("\n=== 验证不存在的 slug ===")
    not_found = await TutorialService.get_article_by_slug(
        db, "not-exist", include_unpublished=False
    )
    assert not_found is None, "不存在的 slug 应返回 None"
    print("返回 None，符合预期")

    print("\n✅ 所有验证通过")


async def main() -> None:
    async with async_session() as db:
        await verify(db)


if __name__ == "__main__":
    asyncio.run(main())
