"""教程模块请求/响应模型。"""
from typing import Optional, Dict, Any, List
from uuid import UUID
from pydantic import BaseModel, Field


class TutorialProgressResponse(BaseModel):
    """用户引导进度响应。"""
    current_step: int = Field(..., description="当前引导步骤（0 表示未开始）")
    total_steps: int = Field(..., description="总步骤数")
    completed: bool = Field(..., description="是否已完成全部引导")
    completed_at: Optional[str] = Field(None, description="完成时间")
    step_details: Optional[Dict[str, Any]] = Field(None, description="各步骤完成状态详情")


class TutorialProgressUpdateRequest(BaseModel):
    """更新引导进度请求。"""
    step: int = Field(..., ge=0, description="步骤编号")
    completed: bool = Field(..., description="该步骤是否完成")


class TutorialProgressUpdateResponse(BaseModel):
    """更新引导进度响应。"""
    success: bool = True
    current_step: int
    total_steps: int
    all_completed: bool


class MetricTooltipResponse(BaseModel):
    """指标解读内容响应。"""
    metric_type: str = Field(..., description="指标类型（如 alpha/kmo 等）")
    title: str = Field(..., description="指标名称")
    content: str = Field(..., description="解读内容（通俗易懂）")
    example: str = Field(..., description="示例说明")


class TermCardResponse(BaseModel):
    """术语卡片（语义搜索命中术语时返回）。"""
    title: str = Field(..., description="术语名称")
    content: str = Field(..., description="术语解释")
    example: str = Field(..., description="示例说明")
    learn_more_slug: Optional[str] = Field(
        None, description="关联的小课堂教程 slug（可去学）"
    )


class TutorialSearchResponse(BaseModel):
    """语义搜索结果。"""
    keyword: str = Field(..., description="搜索关键词")
    term: Optional[TermCardResponse] = Field(None, description="命中的术语卡片（未命中为 null）")


class OnboardingStartRequest(BaseModel):
    """启动引导请求。"""
    project_id: UUID = Field(..., description="项目 ID")


class OnboardingStep(BaseModel):
    """引导步骤。"""
    step: int = Field(..., description="步骤编号")
    title: str = Field(..., description="步骤标题")
    description: str = Field(..., description="步骤说明")
    target: str = Field(..., description="引导目标元素/区域")


class OnboardingStartResponse(BaseModel):
    """启动引导响应。"""
    tour_id: str = Field(..., description="引导会话 ID")
    steps: List[OnboardingStep] = Field(..., description="引导步骤列表")


# ========== 教程文章（统计知识小课堂）==========

class TutorialArticleBase(BaseModel):
    """教程文章基础字段。"""
    slug: str = Field(..., min_length=1, max_length=100, description="URL 友好标识")
    title: str = Field(..., min_length=1, max_length=200, description="教程标题")
    category: str = Field(..., description="分类：basics / methods / writing")
    content_markdown: str = Field(..., min_length=1, description="Markdown 内容")
    summary: Optional[str] = Field(None, max_length=500, description="摘要")
    cover_image: Optional[str] = Field(None, max_length=500, description="封面图 URL")
    order_index: int = Field(default=0, description="排序索引")
    is_published: bool = Field(default=False, description="是否发布")
    tags: Optional[List[str]] = Field(None, description="标签列表（如 [\"信度\",\"效度\"]）")
    difficulty: Optional[str] = Field(
        None, max_length=20,
        description="难度：beginner / intermediate / advanced",
    )


class TutorialArticleCreateRequest(TutorialArticleBase):
    """创建教程文章请求。"""
    pass


class TutorialArticleUpdateRequest(BaseModel):
    """更新教程文章请求。"""
    slug: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=50)
    content_markdown: Optional[str] = Field(None)
    summary: Optional[str] = Field(None, max_length=500)
    cover_image: Optional[str] = Field(None, max_length=500)
    order_index: Optional[int] = Field(None)
    is_published: Optional[bool] = Field(None)
    tags: Optional[List[str]] = Field(None, description="标签列表")
    difficulty: Optional[str] = Field(None, max_length=20, description="难度")


class TutorialArticleResponse(TutorialArticleBase):
    """教程文章响应。"""
    id: UUID = Field(..., description="教程 ID")
    created_at: str = Field(..., description="创建时间")
    updated_at: str = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class TutorialArticleListItem(BaseModel):
    """教程列表项（精简字段）。"""
    id: UUID
    slug: str
    title: str
    category: str
    content_markdown: str = Field(..., description="Markdown 内容（用于估算阅读时长）")
    summary: Optional[str]
    cover_image: Optional[str]
    order_index: int
    is_published: bool
    tags: Optional[List[str]] = None
    difficulty: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class TutorialArticleListResponse(BaseModel):
    """教程列表响应。"""
    items: List[TutorialArticleListItem]
    total: int
    page: int
    page_size: int


class TutorialArticleQueryParams(BaseModel):
    """教程列表查询参数。"""
    category: Optional[str] = Field(None, description="分类筛选")
    tag: Optional[str] = Field(None, description="标签筛选（单个标签）")
    difficulty: Optional[str] = Field(None, description="难度筛选")
    keyword: Optional[str] = Field(None, description="搜索关键词（标题/摘要）")
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=12, ge=1, le=50, description="每页数量")
    include_unpublished: bool = Field(
        default=False, description="是否包含未发布（仅管理员有效）"
    )


# ========== AI 解读助手（阶段三）==========

class AIInterpretRequest(BaseModel):
    """AI 解读请求。"""
    question: Optional[str] = Field(
        None, max_length=500,
        description="用户自定义问题（可选，不传则生成整份报告解读）"
    )
    section: Optional[str] = Field(
        None,
        description="指定解读的报告板块：reliability/correlation/diff_test/overall（可选）"
    )


class AIInterpretResponse(BaseModel):
    """AI 解读响应。"""
    project_id: UUID = Field(..., description="项目 ID")
    content: str = Field(..., description="AI 生成的解读内容（Markdown）")
    section: str = Field(..., description="解读的板块")
    question: Optional[str] = Field(None, description="用户提问（如有）")
    quota_remaining: int = Field(..., description="本周剩余 AI 解读次数")
