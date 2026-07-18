"""题目体检路由（R1~R3：题型识别 / 维度归属 / 反向题标记）。"""
import io
import os
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.responses import ResponseModel
from app.core.exceptions import NotFoundException, ValidationException
from app.models.project import Project
from app.models.question import Question
from app.schemas.questionnaire import (
    QuestionInspectRequest,
    QuestionnaireStructure,
    QuestionResponse,
    QuestionUpdateRequest,
    QuestionUploadResponse,
)
from app.services.inspector import inspect as inspect_service
from app.services.project_service import update_project_status

router = APIRouter(prefix="/questionnaire", tags=["questionnaire"])


# 文件上传限制
_MAX_UPLOAD_SIZE = 2 * 1024 * 1024  # 2MB
_ALLOWED_EXTENSIONS = {".txt", ".docx"}


def _read_text_file(content: bytes) -> str:
    """读取文本文件，依次尝试 UTF-8 / GBK / latin1 编码。"""
    for encoding in ("utf-8", "gbk", "latin1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValidationException("无法识别文本文件编码，请保存为 UTF-8 后重试")


def _read_docx_file(content: bytes) -> str:
    """读取 .docx 文件并提取段落文本。"""
    try:
        import docx
    except ImportError as exc:
        raise ValidationException("缺少 docx 解析依赖，请联系管理员安装 python-docx") from exc

    document = docx.Document(io.BytesIO(content))
    paragraphs = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


@router.post(
    "/inspect",
    response_model=ResponseModel[QuestionnaireStructure],
    summary="题目体检",
    description="识别题型、维度归属、反向题，输出归属表。免费层能力，不含 R4 诊断。"
)
async def inspect(
    project_id: UUID,
    request: QuestionInspectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """题目体检：识别题型、维度归属、反向题，输出归属表。

    免费层能力，不含 R4 诊断。
    """
    # 1. 验证项目存在且属于当前用户
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"]
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")

    # 2. 调用体检服务（LLM R1~R3）
    try:
        questionnaire_structure = inspect_service(request.text)
    except Exception as e:
        raise ValidationException(f"体检失败: {str(e)}")

    # 3. 保存题目到数据库
    for q in questionnaire_structure.questions:
        question = Question(
            project_id=project_id,
            index=q.index,
            text=q.text,
            question_type=q.question_type,
            dimension=q.dimension,
            is_reverse=q.is_reverse,
            confidence=q.confidence
        )
        db.add(question)

    # 4. 更新项目状态为 inspected
    update_project_status(project, "inspected", reason="题目体检完成")
    await db.flush()

    return ResponseModel(data=questionnaire_structure)


@router.post(
    "/upload",
    response_model=ResponseModel[QuestionUploadResponse],
    summary="上传问卷文件",
    description="上传 .txt / .docx 文件并提取原始文本，单文件 ≤ 2MB。",
)
async def upload_questionnaire_file(
    project_id: UUID,
    file: UploadFile = File(..., description="问卷文件，支持 .txt / .docx"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """上传问卷文件并提取原始文本。"""
    # 1. 验证项目存在且属于当前用户
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"]
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")

    # 2. 校验文件名与扩展名
    if not file.filename:
        raise ValidationException("文件名不能为空")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise ValidationException(f"不支持的文件格式：{ext}，仅支持 .txt / .docx")

    # 3. 读取文件内容并校验大小
    content = await file.read()
    if len(content) > _MAX_UPLOAD_SIZE:
        raise ValidationException("文件大小超过 2MB 限制")

    if not content:
        raise ValidationException("文件内容为空")

    # 4. 提取文本
    try:
        if ext == ".txt":
            text = _read_text_file(content)
        else:
            text = _read_docx_file(content)
    except ValidationException:
        raise
    except Exception as e:
        raise ValidationException(f"文件解析失败: {str(e)}")

    return ResponseModel(data=QuestionUploadResponse(text=text))


@router.get(
    "/questions/{project_id}",
    response_model=ResponseModel[List[QuestionResponse]],
    summary="获取题目列表",
    description="获取项目的题目列表"
)
async def get_questions(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """获取项目的题目列表。"""
    # 验证项目存在且属于当前用户
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"]
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")

    # 查询题目
    result = await db.execute(
        select(Question)
        .where(Question.project_id == project_id)
        .order_by(Question.index)
    )
    questions = result.scalars().all()

    return ResponseModel(data=questions)


@router.patch(
    "/questions/{project_id}/{question_index}",
    response_model=ResponseModel[QuestionResponse],
    summary="更新单题（维度/反向题/置信度）",
    description="用户修正 AI 识别结果。仅允许更新 dimension/is_reverse/confidence。"
)
async def update_question(
    project_id: UUID,
    question_index: int,
    request: QuestionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """更新单题（用户修正 AI 识别结果）。"""
    # 1. 验证项目存在且属于当前用户
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"]
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")

    # 2. 查询题目（按 project_id + index 定位）
    result = await db.execute(
        select(Question).where(
            Question.project_id == project_id,
            Question.index == question_index
        )
    )
    question = result.scalar_one_or_none()
    if not question:
        raise NotFoundException("题目不存在")

    # 3. 应用更新（仅非 None 字段）
    if request.dimension is not None:
        question.dimension = request.dimension
    if request.is_reverse is not None:
        question.is_reverse = request.is_reverse
    if request.confidence is not None:
        question.confidence = request.confidence

    await db.flush()
    return ResponseModel(data=question)
