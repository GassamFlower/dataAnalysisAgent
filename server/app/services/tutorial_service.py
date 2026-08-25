"""教程业务逻辑服务。"""
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_tutorial_progress import UserTutorialProgress
from app.models.tutorial_article import TutorialArticle
from app.core.error_messages import ERR_TUTORIAL_NOT_FOUND
from app.schemas.tutorial import (
    TutorialProgressResponse,
    TutorialProgressUpdateResponse,
    MetricTooltipResponse,
    OnboardingStartResponse,
    OnboardingStep,
    TutorialArticleResponse,
    TutorialArticleListItem,
    TutorialArticleListResponse,
    TutorialArticleCreateRequest,
    TutorialArticleUpdateRequest,
)


# 引导步骤定义（共 5 步）
ONBOARDING_STEPS = [
    OnboardingStep(
        step=1,
        title="欢迎使用渔宴数据分析",
        description="这是一个帮助你完成毕业论文数据分析的工具。接下来我们会一步步引导你完成整个流程。",
        target="sidebar-projects",
    ),
    OnboardingStep(
        step=2,
        title="第一步：题目体检",
        description="上传你的问卷题目，AI 会自动识别题型、维度归属和反向题。",
        target="step-inspect",
    ),
    OnboardingStep(
        step=3,
        title="第二步：假设输入",
        description="用一句话描述你的研究假设，系统会自动解析为主效应路径。",
        target="step-hypothesis",
    ),
    OnboardingStep(
        step=4,
        title="第三步：数据预演",
        description="设置样本量和期望趋势，系统会生成模拟数据供你预演分析。",
        target="step-simulate",
    ),
    OnboardingStep(
        step=5,
        title="第四步：生成报告",
        description="系统会自动计算信效度、诊断问题，并生成完整的统计报告。",
        target="step-report",
    ),
]


# 指标解读文案库
METRIC_TOOLTIPS: Dict[str, Dict[str, str]] = {
    "alpha": {
        "title": "Cronbach's α 信度系数",
        "content": "α 系数衡量问卷内部一致性，即同一维度下的题目是否测量同一个概念。α ≥ 0.7 表示信度良好，α ≥ 0.8 表示信度优秀。如果 α 过低，可能是题目表述不清或维度划分不合理。",
        "example": "例如：某维度 α = 0.85，说明该维度的题目内部一致性良好，测量结果稳定可靠。",
    },
    "kmo": {
        "title": "KMO 效度指标",
        "content": "KMO（Kaiser-Meyer-Olkin）衡量样本充足度和偏相关性，用于判断数据是否适合做因子分析。KMO ≥ 0.7 表示适合，KMO ≥ 0.8 表示非常适合，KMO < 0.5 表示不适合。",
        "example": "例如：KMO = 0.82，说明数据非常适合做因子分析，结构效度良好。",
    },
    "bartlett": {
        "title": "Bartlett 球形检验",
        "content": "Bartlett 球形检验用于检验变量间的相关性是否显著。p 值 < 0.05 表示变量间存在显著相关，适合做因子分析。这是效度分析的前提条件。",
        "example": "例如：Bartlett 检验 p < 0.001，说明变量间存在显著相关，可以进行因子分析。",
    },
    "correlation": {
        "title": "相关系数",
        "content": "相关系数衡量两个变量间的线性关系强度和方向。取值范围 -1 到 1：|r| ≥ 0.7 为强相关，0.4 ≤ |r| < 0.7 为中等相关，|r| < 0.4 为弱相关。正值为正相关，负值为负相关。",
        "example": "例如：r = 0.65，表示两个变量存在中等程度的正相关关系。",
    },
    "mean": {
        "title": "均值",
        "content": "均值是所有数据的算术平均数，反映数据的集中趋势。在李克特量表（1-5 分）中，均值接近 3 表示中性态度，接近 5 表示高度同意，接近 1 表示强烈反对。",
        "example": "例如：某题目均值 = 4.2，说明受访者对该题目表述整体持同意态度。",
    },
    "std": {
        "title": "标准差",
        "content": "标准差衡量数据的离散程度。标准差越小，数据越集中；标准差越大，数据越分散。在李克特量表中，标准差 > 1.5 通常表示受访者意见分歧较大。",
        "example": "例如：标准差 = 0.8，说明受访者回答相对集中，意见较为一致。",
    },
    "frequency": {
        "title": "频率分布",
        "content": "频率分布展示各选项的选择比例，帮助了解数据的分布形态。可以判断是否存在天花板效应（高分集中）或地板效应（低分集中），以及数据是否呈正态分布。",
        "example": "例如：选项 5 的频率为 45%，选项 4 为 30%，说明大多数受访者持积极态度。",
    },
    "diagnosis": {
        "title": "智能诊断结论",
        "content": "智能诊断是系统对分析结果的全面体检，检查信度、效度、样本量、反向题等是否达标。诊断通过表示分析结果可信，诊断不通过会给出具体改进建议。",
        "example": "例如：诊断不通过，原因'维度 A 的 α 系数仅 0.58'，建议检查该维度题目表述或重新划分维度。",
    },
    "sample_size": {
        "title": "样本量",
        "content": "样本量影响统计结果的可靠性。一般经验法则：样本量至少为题目数的 5-10 倍。样本量过小可能导致结果不稳定，过大则可能增加收集成本。",
        "example": "例如：问卷有 30 题，建议样本量至少 150-300 份，以保证统计结果的稳定性。",
    },
    "diff_test": {
        "title": "差异检验",
        "content": "差异检验用于判断两组或多组数据是否存在显著差异。常用方法包括 t 检验（两组）和方差分析（多组）。p 值 < 0.05 表示差异显著，即不太可能是随机波动造成的。",
        "example": "例如：男女生在焦虑得分上的 t 检验 p = 0.03，说明性别差异显著，女生焦虑得分显著高于男生。",
    },
    "hit_rate": {
        "title": "预演命中率（统计功效 Power）",
        "content": "预演命中率指在给定效应量（如 r、d）与样本量下，这套研究有把握检出显著结果的概率（α=0.05 双侧）。它回答「发问卷前先预演：方向对不对、要收多少人」。命中率 ≥ 80% 为理想，低于 60% 通常说明效应偏弱或样本不足。",
        "example": "例如：某假设 r=0.35、每组 60 人时预演命中率 63%，建议把样本量提到约每组 90 人，或将预期相关上调后再预演校准。",
    },
    "effect_size": {
        "title": "效应量（Effect Size）",
        "content": "效应量衡量变量间关系或组间差异的实际强弱，不受样本量影响。常用指标：相关 r、Cohen's d、η²。|r| 0.10~0.30 为小，0.30~0.50 为中等，>0.50 为大。效应量小、样本又少时，就算有真实关系也容易检不出来。",
        "example": "例如：某相关 r=0.22 属于小到中等效应，若每组样本不足 100，预演命中率会明显偏低，需加大样本量。",
    },
}

# 搜索关键词 → 指标类型（语义搜索术语解析，未命中返回 None）
TERM_ALIASES: Dict[str, str] = {
    "信度": "alpha", "cronbach": "alpha", "alpha": "alpha", "α": "alpha",
    "效度": "kmo", "kmo": "kmo", "结构效度": "kmo",
    "bartlett": "bartlett", "球形检验": "bartlett", "球型检验": "bartlett",
    "相关": "correlation", "相关性": "correlation", "相关系数": "correlation",
    "correlation": "correlation", "r值": "correlation", "相关分析": "correlation",
    "均值": "mean", "平均": "mean", "mean": "mean", "平均数": "mean",
    "标准差": "std", "方差": "std", "std": "std", "离散": "std",
    "频率": "frequency", "分布": "frequency", "frequency": "frequency", "频数": "frequency",
    "诊断": "diagnosis", "诊断结论": "diagnosis", "diagnosis": "diagnosis",
    "样本量": "sample_size", "样本": "sample_size", "sample": "sample_size", "sample size": "sample_size",
    "差异检验": "diff_test", "t检验": "diff_test",
    "方差分析": "diff_test", "anova": "diff_test", "差异": "diff_test", "假设检验": "diff_test",
    "命中率": "hit_rate", "功效": "hit_rate", "power": "hit_rate", "预演": "hit_rate",
    "效应量": "effect_size", "effect size": "effect_size", "effectsize": "effect_size", "cohen": "effect_size",
}

# 指标类型 → 小课堂教程 slug（已在 seed 中发布，用于术语卡片「去学」跳转）
TERM_LEARN_MORE: Dict[str, str] = {
    "alpha": "cronbach-alpha",
    "kmo": "kmo-bartlett",
    "bartlett": "kmo-bartlett",
    "correlation": "correlation-analysis",
    "diff_test": "hypothesis-testing",
    "sample_size": "sample-size",
    "hit_rate": "sample-size-power",
    "effect_size": "effect-size",
    "diagnosis": "writing-results",
    "mean": "descriptive-statistics",
    "std": "descriptive-statistics",
    "frequency": "descriptive-statistics",
}


class TutorialService:
    """教程业务逻辑服务。"""

    @staticmethod
    async def get_progress(
        db: AsyncSession, user_id: uuid.UUID
    ) -> TutorialProgressResponse:
        """获取用户引导进度。"""
        result = await db.execute(
            select(UserTutorialProgress).where(
                UserTutorialProgress.user_id == user_id
            )
        )
        progress = result.scalar_one_or_none()

        if not progress:
            # 首次访问，返回默认值
            return TutorialProgressResponse(
                current_step=0,
                total_steps=len(ONBOARDING_STEPS),
                completed=False,
                completed_at=None,
                step_details=None,
            )

        return TutorialProgressResponse(
            current_step=progress.current_step,
            total_steps=progress.total_steps,
            completed=progress.completed,
            completed_at=progress.completed_at.isoformat() if progress.completed_at else None,
            step_details=progress.step_details,
        )

    @staticmethod
    async def update_progress(
        db: AsyncSession,
        user_id: uuid.UUID,
        step: int,
        completed: bool,
    ) -> TutorialProgressUpdateResponse:
        """更新用户引导进度。"""
        total_steps = len(ONBOARDING_STEPS)

        # 校验步骤范围
        if step < 0 or step > total_steps:
            from app.core.exceptions import ValidationException
            raise ValidationException(f"步骤编号无效，必须在 0-{total_steps} 之间")

        # 查询或创建进度记录
        result = await db.execute(
            select(UserTutorialProgress).where(
                UserTutorialProgress.user_id == user_id
            )
        )
        progress = result.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if not progress:
            # 首次更新，创建新记录
            step_details = {str(i): False for i in range(1, total_steps + 1)}
            step_details[str(step)] = completed

            progress = UserTutorialProgress(
                user_id=user_id,
                current_step=step,
                total_steps=total_steps,
                completed=all(step_details.values()),
                completed_at=now if all(step_details.values()) else None,
                step_details=step_details,
                created_at=now,
                updated_at=now,
            )
            db.add(progress)
        else:
            # 更新现有记录
            progress.current_step = step
            if progress.step_details is None:
                progress.step_details = {str(i): False for i in range(1, total_steps + 1)}
            progress.step_details[str(step)] = completed

            # 检查是否全部完成
            all_completed = all(progress.step_details.values())
            if all_completed and not progress.completed:
                progress.completed = True
                progress.completed_at = now

        await db.flush()

        return TutorialProgressUpdateResponse(
            success=True,
            current_step=progress.current_step,
            total_steps=progress.total_steps,
            all_completed=progress.completed,
        )

    @staticmethod
    async def reset_progress(
        db: AsyncSession, user_id: uuid.UUID
    ) -> bool:
        """重置用户引导进度（用于重新播放引导）。"""
        result = await db.execute(
            select(UserTutorialProgress).where(
                UserTutorialProgress.user_id == user_id
            )
        )
        progress = result.scalar_one_or_none()

        if progress:
            await db.delete(progress)
            await db.flush()

        return True

    @staticmethod
    def get_metric_tooltip(metric_type: str) -> Optional[MetricTooltipResponse]:
        """获取指标解读内容。"""
        tooltip_data = METRIC_TOOLTIPS.get(metric_type)
        if not tooltip_data:
            return None

        return MetricTooltipResponse(
            metric_type=metric_type,
            title=tooltip_data["title"],
            content=tooltip_data["content"],
            example=tooltip_data["example"],
        )

    @staticmethod
    def get_all_metric_types() -> list:
        """获取所有支持的指标类型。"""
        return list(METRIC_TOOLTIPS.keys())

    @staticmethod
    def search_terms(keyword: str) -> Optional["TermCardResponse"]:
        """语义搜索术语解析：把自然语言关键词解析为术语卡片。

        命中 TERM_ALIASES 则返回对应术语卡片（含去学跳转 slug），否则返回 None。
        """
        text = (keyword or "").strip().lower()
        if not text:
            return None

        metric_type = TERM_ALIASES.get(text)
        if not metric_type:
            # 中文前后缀很常见，做一次简短包含匹配兜底（如「信度低怎么办」→ alpha）
            for alias, mt in TERM_ALIASES.items():
                if len(alias) >= 2 and alias in text:
                    metric_type = mt
                    break

        if not metric_type:
            return None

        data = METRIC_TOOLTIPS.get(metric_type)
        if not data:
            return None

        from app.schemas.tutorial import TermCardResponse
        return TermCardResponse(
            title=data["title"],
            content=data["content"],
            example=data["example"],
            learn_more_slug=TERM_LEARN_MORE.get(metric_type),
        )

    @staticmethod
    async def start_onboarding(
        db: AsyncSession, user_id: uuid.UUID, project_id: uuid.UUID
    ) -> OnboardingStartResponse:
        """启动引导流程。"""
        import uuid as uuid_module

        # 生成引导会话 ID
        tour_id = str(uuid_module.uuid4())

        return OnboardingStartResponse(
            tour_id=tour_id,
            steps=ONBOARDING_STEPS,
        )

    # ========== 教程文章（统计知识小课堂）==========

    @staticmethod
    def _decode_tags(raw: Optional[str]) -> Optional[List[str]]:
        """将数据库中的 tags JSON 字符串还原为列表。"""
        if raw is None or raw == "":
            return None
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else None
        except (json.JSONDecodeError, TypeError):
            return None

    @staticmethod
    def _encode_tags(tags: Optional[List[str]]) -> Optional[str]:
        """将标签列表编码为数据库中的 JSON 字符串。"""
        if tags is None:
            return None
        cleaned = [str(t).strip() for t in tags if str(t).strip()]
        if not cleaned:
            return None
        return json.dumps(cleaned, ensure_ascii=False)

    @staticmethod
    def _article_to_response(article: TutorialArticle) -> TutorialArticleResponse:
        """将 ORM 模型转换为响应 schema。"""
        return TutorialArticleResponse(
            id=article.id,
            slug=article.slug,
            title=article.title,
            category=article.category,
            content_markdown=article.content_markdown,
            summary=article.summary,
            cover_image=article.cover_image,
            order_index=article.order_index,
            is_published=article.is_published,
            tags=TutorialService._decode_tags(article.tags),
            difficulty=article.difficulty,
            created_at=article.created_at.isoformat() if article.created_at else "",
            updated_at=article.updated_at.isoformat() if article.updated_at else "",
        )

    @staticmethod
    def _article_to_list_item(article: TutorialArticle) -> TutorialArticleListItem:
        """将 ORM 模型转换为列表项 schema。"""
        return TutorialArticleListItem(
            id=article.id,
            slug=article.slug,
            title=article.title,
            category=article.category,
            content_markdown=article.content_markdown,
            summary=article.summary,
            cover_image=article.cover_image,
            order_index=article.order_index,
            is_published=article.is_published,
            tags=TutorialService._decode_tags(article.tags),
            difficulty=article.difficulty,
            created_at=article.created_at.isoformat() if article.created_at else "",
        )

    @staticmethod
    async def create_article(
        db: AsyncSession, request: TutorialArticleCreateRequest
    ) -> TutorialArticleResponse:
        """创建教程文章。"""
        # 检查 slug 是否已存在
        result = await db.execute(
            select(TutorialArticle).where(
                TutorialArticle.slug == request.slug,
                TutorialArticle.deleted_at.is_(None),
            )
        )
        if result.scalar_one_or_none():
            from app.core.exceptions import BusinessException
            raise BusinessException(
                code=80003,
                message=f"教程标识 '{request.slug}' 已存在",
            )

        article = TutorialArticle(
            slug=request.slug,
            title=request.title,
            category=request.category,
            content_markdown=request.content_markdown,
            summary=request.summary,
            cover_image=request.cover_image,
            order_index=request.order_index,
            is_published=request.is_published,
            tags=TutorialService._encode_tags(request.tags),
            difficulty=request.difficulty,
        )
        db.add(article)
        await db.flush()
        await db.refresh(article)

        return TutorialService._article_to_response(article)

    @staticmethod
    async def update_article(
        db: AsyncSession, article_id: uuid.UUID, request: TutorialArticleUpdateRequest
    ) -> TutorialArticleResponse:
        """更新教程文章。"""
        result = await db.execute(
            select(TutorialArticle).where(
                TutorialArticle.id == article_id,
                TutorialArticle.deleted_at.is_(None),
            )
        )
        article = result.scalar_one_or_none()
        if not article:
            from app.core.exceptions import NotFoundException
            raise NotFoundException(ERR_TUTORIAL_NOT_FOUND)

        # 如果修改 slug，检查是否与其他文章冲突
        if request.slug is not None and request.slug != article.slug:
            result = await db.execute(
                select(TutorialArticle).where(
                    TutorialArticle.slug == request.slug,
                    TutorialArticle.deleted_at.is_(None),
                    TutorialArticle.id != article_id,
                )
            )
            if result.scalar_one_or_none():
                from app.core.exceptions import BusinessException
                raise BusinessException(
                    code=80003,
                    message=f"教程标识 '{request.slug}' 已存在",
                )
            article.slug = request.slug

        update_fields = [
            "title",
            "category",
            "content_markdown",
            "summary",
            "cover_image",
            "order_index",
            "is_published",
            "difficulty",
        ]
        for field in update_fields:
            value = getattr(request, field)
            if value is not None:
                setattr(article, field, value)

        if request.tags is not None:
            if request.tags:
                article.tags = TutorialService._encode_tags(request.tags)
            else:
                article.tags = None

        await db.flush()
        await db.refresh(article)

        return TutorialService._article_to_response(article)

    @staticmethod
    async def delete_article(
        db: AsyncSession, article_id: uuid.UUID
    ) -> bool:
        """软删除教程文章。"""
        result = await db.execute(
            select(TutorialArticle).where(
                TutorialArticle.id == article_id,
                TutorialArticle.deleted_at.is_(None),
            )
        )
        article = result.scalar_one_or_none()
        if not article:
            from app.core.exceptions import NotFoundException
            raise NotFoundException(ERR_TUTORIAL_NOT_FOUND)

        article.deleted_at = datetime.now(timezone.utc)
        await db.flush()
        return True

    @staticmethod
    async def get_article_by_slug(
        db: AsyncSession, slug: str, include_unpublished: bool = False
    ) -> Optional[TutorialArticleResponse]:
        """根据 slug 获取教程文章。"""
        stmt = select(TutorialArticle).where(
            TutorialArticle.slug == slug,
            TutorialArticle.deleted_at.is_(None),
        )
        if not include_unpublished:
            stmt = stmt.where(TutorialArticle.is_published.is_(True))

        result = await db.execute(stmt)
        article = result.scalar_one_or_none()
        if not article:
            return None

        return TutorialService._article_to_response(article)

    @staticmethod
    async def list_articles(
        db: AsyncSession,
        category: Optional[str] = None,
        tag: Optional[str] = None,
        difficulty: Optional[str] = None,
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 12,
        include_unpublished: bool = False,
    ) -> TutorialArticleListResponse:
        """分页查询教程文章列表。"""
        from sqlalchemy import func, or_

        stmt = select(TutorialArticle).where(TutorialArticle.deleted_at.is_(None))

        if not include_unpublished:
            stmt = stmt.where(TutorialArticle.is_published.is_(True))

        if category:
            stmt = stmt.where(TutorialArticle.category == category)

        if tag:
            # tags 存为 JSON 数组字符串，如 ["信度","效度"]；按包含该标签子串过滤
            like = f"%{tag}%"
            stmt = stmt.where(TutorialArticle.tags.ilike(like))

        if difficulty:
            stmt = stmt.where(TutorialArticle.difficulty == difficulty)

        if keyword:
            like_pattern = f"%{keyword}%"
            stmt = stmt.where(
                or_(
                    TutorialArticle.title.ilike(like_pattern),
                    TutorialArticle.summary.ilike(like_pattern),
                )
            )

        # 总数
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar() or 0

        # 分页
        stmt = stmt.order_by(TutorialArticle.order_index, TutorialArticle.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(stmt)
        articles = result.scalars().all()

        return TutorialArticleListResponse(
            items=[
                TutorialService._article_to_list_item(a) for a in articles
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

    # ========== AI 解读助手（阶段三）==========

    # 板块 → 中文名映射
    SECTION_LABELS = {
        "reliability": "信效度分析",
        "correlation": "相关分析",
        "diff_test": "差异检验",
        "overall": "整体报告",
    }

    @staticmethod
    async def ai_interpret(
        db: AsyncSession,
        project_id: uuid.UUID,
        question: Optional[str],
        section: Optional[str],
    ) -> Dict[str, Any]:
        """基于项目最新报告，调用 LLM 生成通俗解读与论文写作建议。

        流程：
        1. 读取项目最新报告（含信效度结果 + 诊断结论）
        2. 将统计数据序列化为紧凑文本，拼接 system / user prompt
        3. 调用 Flash 级 LLM 生成 Markdown 解读
        4. 返回内容 + 板块 + 剩余额度（额度由路由层扣减后传入）

        若无已存报告，抛出 NotFoundException。
        """
        from sqlalchemy.orm import selectinload
        from app.models.report import Report
        from app.models.reliability_result import ReliabilityResult
        from app.models.diagnosis import Diagnosis
        from app.core.exceptions import NotFoundException

        # 1. 读取最新报告
        result = await db.execute(
            select(Report)
            .options(
                selectinload(Report.reliability_results),
                selectinload(Report.diagnosis).selectinload(Diagnosis.issues),
            )
            .where(Report.project_id == project_id)
            .order_by(Report.created_at.desc())
            .limit(1)
        )
        report = result.scalar_one_or_none()
        if not report:
            raise NotFoundException("该项目尚未生成报告，请先运行报告分析")

        # 2. 序列化统计数据
        stats_lines: list[str] = []
        stats_lines.append(f"样本量相关：overall_alpha={report.overall_alpha:.3f}")
        stats_lines.append(
            f"信效度：通过 {report.passed_count}/{report.total_count} 个维度"
        )
        for r in report.reliability_results:
            stats_lines.append(
                f"  - 维度[{r.dimension}] α={r.alpha:.3f} KMO={r.kmo:.3f} "
                f"Bartlett p={r.bartlett_p_value:.4f} 达标={'是' if r.passed else '否'}"
            )

        if report.diagnosis:
            stats_lines.append(
                f"智能诊断：{'通过' if report.diagnosis.passed else '未通过'}"
            )
            for issue in report.diagnosis.issues[:10]:
                stats_lines.append(
                    f"  - [{issue.dimension}] {issue.metric}: "
                    f"值={issue.value:.3f} 阈值={issue.threshold:.3f}"
                )
                if issue.reason:
                    stats_lines.append(f"    原因: {issue.reason}")
                if issue.suggestion:
                    stats_lines.append(f"    建议: {issue.suggestion}")

        stats_text = "\n".join(stats_lines)

        # 3. 构造 prompt
        target_section = section or "overall"
        section_label = TutorialService.SECTION_LABELS.get(
            target_section, "整体报告"
        )

        system_prompt = (
            "你是统计数据分析与论文写作助手。你的任务是根据用户项目的统计结果，"
            "用通俗易懂的语言解读数据含义，并给出可直接写入论文的段落建议。\n"
            "输出要求：\n"
            "1. 使用 Markdown 格式\n"
            "2. 先给「数据解读」段落（解释指标含义、当前结果说明什么）\n"
            "3. 再给「论文写作建议」段落（给出可参考的规范句式，用引用块标记）\n"
            "4. 语言面向本科生，避免过度学术化\n"
            "5. 不要编造数据中不存在的指标"
        )

        user_prompt = (
            f"请解读以下项目的【{section_label}】部分。\n\n"
            f"## 项目统计数据\n```\n{stats_text}\n```\n\n"
        )
        if question:
            user_prompt += f"## 用户提问\n{question}\n\n"
        user_prompt += "请按上述要求输出解读与写作建议。"

        # 4. 调用 LLM（Flash 级，成本低、响应快）
        from app.services.llm.client import chat_flash

        content = chat_flash(user_prompt, system=system_prompt)

        return {
            "project_id": str(project_id),
            "content": content,
            "section": target_section,
            "question": question,
        }
