"""学科量表库种子数据导入脚本（Task 4.1，3NF：scale → dimensions → items）。

运行方式：
    cd server
    python -m scripts.seed_scales
幂等：按 slug 查重，已存在则跳过该量表。
"""
import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models.research_scale import ResearchScale, ScaleDimension, ScaleItem


DISCIPLINE_LABELS = {
    "management": "管理学",
    "education": "教育学",
    "psychology": "心理学",
}

# 量表种子：管理/教育/心理各 3 条。来源与信效度引用指向公开出处。
SCALES = [
    # ── 管理学 ─────────────────────────────────────────────
    {
        "slug": "job-satisfaction-jds",
        "name": "工作满意度量表（JSS 简版）",
        "discipline": "management",
        "description": "基于 Spector 工作满意度问卷（JSS）改编的简版，衡量员工对工作整体的满意度状况。",
        "scoring_method": "Likert 五点量表（1=非常不同意，5=非常同意），建议用 Cronbach's α 检验内部一致性。",
        "source": "Spector, P. E. (1985). Measurement of human service staff satisfaction: Development of the Job Satisfaction Survey. American Journal of Community Psychology, 13(6), 693-713.",
        "reliability_ref": "原量表各分量表 α 通常在 0.70~0.90；本条目为研究预演用条目模板，正式使用前请核对信度。",
        "validity_ref": "JSS 广泛用于组织研究并支持其结构效度；引用详见 Spector(1985)。",
        "dimensions": [
            {"name": "总体满意", "items": [
                {"text": "总体而言，我对当前工作感到满意。", "is_reverse": False},
                {"text": "我很少觉得工作有意义或值得投入。", "is_reverse": True},
            ]},
            {"name": "薪酬满意", "items": [
                {"text": "我的付出与所得报酬是匹配的。", "is_reverse": False},
                {"text": "我经常觉得报酬与工作量不成比例。", "is_reverse": True},
            ]},
        ],
    },
    {
        "slug": "organizational-commitment",
        "name": "组织承诺量表（OCQ 简版）",
        "discipline": "management",
        "description": "测量员工对组织的认同感、情感依恋与继续留任意愿。",
        "scoring_method": "Likert 五点量表；维度均分越高代表承诺水平越高（反向题需先反转）。",
        "source": "Mowday, R. T., Steers, R. M., & Porter, L. W. (1979). The measurement of organizational commitment. Journal of Vocational Behavior, 14(2), 224-247.",
        "reliability_ref": "OCQ 原量表 α 多在 0.80 以上；本条目为模板，正式研究请以实测信度为准。",
        "validity_ref": "结构效度被后续大量组织行为研究重复验证。",
        "dimensions": [
            {"name": "认同感", "items": [
                {"text": "我以自己作为本组织的一员而感到自豪。", "is_reverse": False},
                {"text": "组织的价值观与我个人的价值观一致。", "is_reverse": False},
            ]},
            {"name": "留任意愿", "items": [
                {"text": "如果有更好的机会，我也不会轻易离开本组织。", "is_reverse": False},
                {"text": "我常常思考离开当前组织。", "is_reverse": True},
            ]},
        ],
    },
    {
        "slug": "leadership-tlq",
        "name": "变革型领导量表（TLQ 简版）",
        "discipline": "management",
        "description": "基于 Bass 变革型领导理论的简版条目，衡量领导魅力、感召力与个性化关怀。",
        "scoring_method": "Likert 五点量表；各维度均分为该领导特质水平。",
        "source": "Bass, B. M., & Avolio, B. J. (1995). MLQ: Multifactor Leadership Questionnaire. Mind Garden.",
        "reliability_ref": "MLQ 各维度 α 普遍在 0.70 以上。",
        "validity_ref": "变革型领导与下属绩效、满意度关系被广泛验证（见 Bass & Avolio, 1995）。",
        "dimensions": [
            {"name": "感召力", "items": [
                {"text": "领导能清晰描绘充满吸引力的未来愿景。", "is_reverse": False},
            ]},
            {"name": "个性化关怀", "items": [
                {"text": "领导关注每一位下属的个人成长与发展。", "is_reverse": False},
                {"text": "领导很少关心下属的工作困难。", "is_reverse": True},
            ]},
        ],
    },
    # ── 教育学 ─────────────────────────────────────────────
    {
        "slug": "learning-motivation-el",
        "name": "学生学习动机量表",
        "discipline": "education",
        "description": "测量学生在学习过程中的内在动机与外在动机水平。",
        "scoring_method": "Likert 五点量表；内在动机维度和外在动机维度分别取均分。",
        "source": "基于 Deci & Ryan 自我决定理论改编的课堂学习动机条目（教育研究常用改编版）。",
        "reliability_ref": "改编版 α 多在 0.70~0.85，正式使用建议复验。",
        "validity_ref": "动机两维度结构与自我决定理论相符（Deci & Ryan, 2000）。",
        "dimensions": [
            {"name": "内在动机", "items": [
                {"text": "我学习是因为我对所学内容本身感兴趣。", "is_reverse": False},
                {"text": "即使没有考试压力，我也愿意主动学习。", "is_reverse": False},
            ]},
            {"name": "外在动机", "items": [
                {"text": "我学习主要是为了获得好成绩或奖励。", "is_reverse": False},
                {"text": "如果学习没有回报，我就不太愿意投入。", "is_reverse": True},
            ]},
        ],
    },
    {
        "slug": "academic-self-efficacy",
        "name": "学业自我效能感量表",
        "discipline": "education",
        "description": "测量学生对完成学业任务、应对学习挑战的信心。",
        "scoring_method": "Likert 五点量表；总分或均分越高代表效能感越强。",
        "source": "改编自 Pintrich 学习动机策略问卷（MSLQ）中的自我效能分量表。",
        "reliability_ref": "MSLQ 自我效能分量表 α 常在 0.85 以上。",
        "validity_ref": "自我效能与学业成绩的显著正相关被广泛报告。",
        "dimensions": [
            {"name": "任务信心", "items": [
                {"text": "我相信自己能掌握这门课程的核心内容。", "is_reverse": False},
                {"text": "面对困难作业时，我常常觉得自己无能为力。", "is_reverse": True},
            ]},
            {"name": "应对挑战", "items": [
                {"text": "遇到不会的题目时，我会坚持想办法解决。", "is_reverse": False},
            ]},
        ],
    },
    {
        "slug": "teaching-quality-satisfaction",
        "name": "教学满意度量表",
        "discipline": "education",
        "description": "评估学生对教学质量、教学组织与师生互动的满意度。",
        "scoring_method": "Likert 五点量表；维度均分作为满意度评价。",
        "source": "教育满意度研究常用条目整合（教学评估情境）。",
        "reliability_ref": "α 多在 0.80 左右，正式使用需复验。",
        "validity_ref": "满意度与课程投入、出勤等行为指标相关显著。",
        "dimensions": [
            {"name": "教学组织", "items": [
                {"text": "课程内容安排清晰、有条理。", "is_reverse": False},
                {"text": "老师的课堂节奏常常让我跟不上。", "is_reverse": True},
            ]},
            {"name": "师生互动", "items": [
                {"text": "课堂中老师乐于回答学生的疑问。", "is_reverse": False},
            ]},
        ],
    },
    # ── 心理学 ─────────────────────────────────────────────
    {
        "slug": "self-esteem-rses",
        "name": "自我效能与自尊量表（RSES 简版）",
        "discipline": "psychology",
        "description": "基于 Rosenberg 自尊量表（RSES）的简版，测量整体自我价值感。",
        "scoring_method": "Likert 四点量表（1=非常不同意，4=非常同意）；含反向题，总分越高自尊越强。",
        "source": "Rosenberg, M. (1965). Society and the Adolescent Self-Image. Princeton University Press.",
        "reliability_ref": "RSES 原量表 α 常规在 0.80 以上（跨文化样本）。",
        "validity_ref": "与抑郁、生活满意度的显著相关被大量报告。",
        "dimensions": [
            {"name": "自我价值", "items": [
                {"text": "总体而言，我对自己是满意的。", "is_reverse": False},
                {"text": "我常觉得自己一无是处。", "is_reverse": True},
            ]},
            {"name": "自我接纳", "items": [
                {"text": "我能像大多数优秀的人一样把事情做好。", "is_reverse": False},
                {"text": "我希望自己能更尊重自己。", "is_reverse": True},
            ]},
        ],
    },
    {
        "slug": "life-satisfaction-swls",
        "name": "生活满意度量表（SWLS）",
        "discipline": "psychology",
        "description": "测量个体对整体生活质量的主观满意度评价。",
        "scoring_method": "Likert 七点量表；各题求和或取均分为整体生活满意度。",
        "source": "Diener, E., Emmons, R. A., Larsen, R. J., & Griffin, S. (1985). The Satisfaction With Life Scale. Journal of Personality Assessment, 49(1), 71-75.",
        "reliability_ref": "SWLS 原量表 α 常在 0.79~0.89。",
        "validity_ref": "与传统单题满意度的相关、跨时间重测稳定性良好。",
        "dimensions": [
            {"name": "整体满意度", "items": [
                {"text": "在大多数方面，我的生活接近我理想的状态。", "is_reverse": False},
                {"text": "我的生活到目前为止是令人满意的。", "is_reverse": False},
            ]},
        ],
    },
    {
        "slug": "perceived-stress-pss",
        "name": "知觉压力量表（PSS 简版）",
        "discipline": "psychology",
        "description": "测量个体近一个月感知压力的程度与应对不确定性的感受。",
        "scoring_method": "Likert 五点量表（0=从不，4=非常频繁）；反向题需先反转，总分越高压力越大。",
        "source": "Cohen, S., Kamarck, T., & Mermelstein, R. (1983). A global measure of perceived stress. Journal of Health and Social Behavior, 24(4), 385-396.",
        "reliability_ref": "PSS 原量表 α 通常在 0.80 以上。",
        "validity_ref": "与生活事件、健康自评的相关显著；结构效度跨文化稳定。",
        "dimensions": [
            {"name": "失控感", "items": [
                {"text": "常感到事情不在自己的掌控之中。", "is_reverse": False},
                {"text": "感到困难不断累积，自己无法应对。", "is_reverse": False},
            ]},
            {"name": "恢复感", "items": [
                {"text": "我能从容应对生活中发生的变化。", "is_reverse": True},
                {"text": "我觉得自己能把事情都处理得很好。", "is_reverse": True},
            ]},
        ],
    },
]


async def seed_scales(db: AsyncSession) -> None:
    """导入量表种子数据（按 slug 幂等；已存在则跳过整条量表）。"""
    now = datetime.now(timezone.utc)
    inserted = 0
    skipped = 0

    for meta in SCALES:
        result = await db.execute(
            select(ResearchScale).where(ResearchScale.slug == meta["slug"])
        )
        if result.scalar_one_or_none() is not None:
            skipped += 1
            print(f"[SKIP] 量表已存在: {meta['slug']}")
            continue

        scale = ResearchScale(
            id=uuid.uuid4(),
            slug=meta["slug"],
            name=meta["name"],
            discipline=meta["discipline"],
            description=meta["description"],
            scoring_method=meta["scoring_method"],
            source=meta["source"],
            reliability_ref=meta["reliability_ref"],
            validity_ref=meta["validity_ref"],
            is_published=True,
            created_at=now,
            updated_at=now,
        )
        db.add(scale)
        await db.flush()  # 取得 scale.id

        for dim_i, dim_meta in enumerate(meta["dimensions"], start=1):
            dim = ScaleDimension(
                id=uuid.uuid4(),
                scale_id=scale.id,
                index=dim_i,
                name=dim_meta["name"],
                created_at=now,
            )
            db.add(dim)
            await db.flush()  # 取得 dim.id
            for item_i, item_meta in enumerate(dim_meta["items"], start=1):
                db.add(ScaleItem(
                    id=uuid.uuid4(),
                    dimension_id=dim.id,
                    index=item_i,
                    text=item_meta["text"],
                    is_reverse=item_meta.get("is_reverse", False),
                    created_at=now,
                ))

        inserted += 1
        print(f"[INSERT] {meta['slug']}: {meta['name']}")

    await db.commit()
    print(
        f"\n完成：新增 {inserted} 条量表，跳过 {skipped} 条，共配置 {len(SCALES)} 条。"
    )


async def main() -> None:
    async with async_session() as db:
        await seed_scales(db)


if __name__ == "__main__":
    asyncio.run(main())