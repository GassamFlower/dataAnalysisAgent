"""文字体检（去 AI 味）路由。"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ValidationException
from app.core.responses import ResponseModel
from app.schemas.ai_tone import (
    AiToneAnalyzeRequest,
    AiToneAnalyzeResponse,
    AiToneRewriteRequest,
    AiToneRewriteResponse,
)
from app.services.ai_tone import analyze_text, rewrite_text, validate_text
from app.services.audit_service import ACTION_TYPES, AuditService
from app.services.quota_service import check_and_consume_quota

router = APIRouter(prefix="/ai-tone", tags=["ai-tone"])


@router.post(
    "/analyze",
    response_model=ResponseModel[AiToneAnalyzeResponse],
    summary="文字体检",
    description="确定性检测 AI 写作痕迹与结构指标。免费，不保存文本。",
)
async def analyze(request: AiToneAnalyzeRequest):
    """检测文本的可处理项、结构提示与保持不变项。"""
    try:
        result = analyze_text(request.text)
    except ValueError as exc:
        raise ValidationException(str(exc)) from exc
    return ResponseModel(data=AiToneAnalyzeResponse(**result))


@router.post(
    "/rewrite",
    response_model=ResponseModel[AiToneRewriteResponse],
    summary="按检测结果改写",
    description="登录后使用，免费用户每周 3 次。改写后自动复测并校验数字与引文。",
)
async def rewrite(
    request: AiToneRewriteRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """按检测清单做最小改写，返回前后对比。"""
    try:
        normalized = validate_text(request.text)
    except ValueError as exc:
        raise ValidationException(str(exc)) from exc

    await check_and_consume_quota(
        db,
        current_user["id"],
        "ai_tone",
        current_user["plan"],
        current_user.get("plan_expires_at"),
    )

    try:
        result = rewrite_text(normalized)
    except ValueError as exc:
        raise ValidationException(str(exc)) from exc

    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES.get("AI_TONE_REWRITE", "ai_tone_rewrite"),
        action_detail={
            "chars": len(normalized),
            "changes": len(result["changes"]),
            "semantic_issues": len(result["semantic_issues"]),
        },
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent"),
    )

    return ResponseModel(data=AiToneRewriteResponse(**result))
