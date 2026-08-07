"""数据集路由（真实回收数据导入）。"""
import io
import os
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import pandas as pd
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundException, ValidationException
from app.core.responses import ResponseModel
from app.models.dataset import Dataset
from app.models.question import Question
from app.schemas.dataset import (
    DatasetImportResponse,
    DatasetInfoResponse,
    DatasetSource,
    DatasetTemplateFormat,
    DatasetTemplateMatchBy,
)
from app.services.audit_service import ACTION_TYPES, AuditService
from app.services.project_service import get_owned_project
from app.services.quota_service import check_and_consume_quota

router = APIRouter(prefix="/dataset", tags=["dataset"])

# 文件上传限制
_MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
_ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".sav"}

# 文件头魔数（防扩展名伪装攻击）；.csv 无固定魔数，跳过魔数校验
_FILE_MAGIC_BYTES: Dict[str, List[bytes]] = {
    # .xlsx 本质是 ZIP 容器，魔数为 PK\x03\x04
    ".xlsx": [b"PK\x03\x04"],
    # .sav 是 SPSS 二进制文件，头 4 字节为 $FL2（0x24 0x46 0x4C 0x32）
    ".sav": [b"\x24FL2"],
}

# 最小样本量
_MIN_SAMPLE_SIZE = 30

# 最大缺失率
_MAX_MISSING_RATIO = 0.30


def _validate_file_magic(filename: str, content: bytes) -> None:
    """校验文件头魔数，防止扩展名伪装攻击。

    .csv 无固定魔数，跳过；.xlsx / .sav 按 _FILE_MAGIC_BYTES 校验。
    """
    ext = os.path.splitext(filename)[1].lower()
    magic_list = _FILE_MAGIC_BYTES.get(ext)
    if not magic_list:
        return  # .csv 等无魔数格式跳过

    # 文件内容不足以包含魔数 → 异常
    if len(content) < 4:
        raise ValidationException("文件内容过短，疑似损坏或伪造")

    for magic in magic_list:
        if content.startswith(magic):
            return

    raise ValidationException(
        f"文件头魔数与 {ext} 格式不匹配，疑似伪装文件"
    )


def _normalize_text(text: str) -> str:
    """规范化文本：去除首尾空白，合并连续空格。"""
    return re.sub(r"\s+", " ", text.strip())


# Excel/CSV 公式注入防护：列名/单元格以这些字符开头会被 Excel 当公式执行。
_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _safe_cell(value: str) -> str:
    """防公式注入：去除首尾空白后若以危险字符开头，前置单引号。"""
    if isinstance(value, str) and value.strip().startswith(_DANGEROUS_PREFIXES):
        return f"'{value}"
    return value


def _build_column_mapping(
    questions: List[Question],
    uploaded_columns: List[str],
    match_by: DatasetTemplateMatchBy,
) -> Dict[str, str]:
    """构建上传列名 → 标准列名 q{index} 的映射。

    Args:
        questions: 项目下的题目列表
        uploaded_columns: 用户上传文件的列名
        match_by: 匹配方式（index / text）

    Returns:
        上传列名到标准列名的映射

    Raises:
        ValidationException: 列名不匹配
    """
    normalized_uploaded = {col: _normalize_text(col) for col in uploaded_columns}
    mapping: Dict[str, str] = {}

    for q in questions:
        target_col = f"q{q.index}"
        matched_col: Optional[str] = None

        if match_by == DatasetTemplateMatchBy.INDEX:
            # 优先匹配 "Q1" / "q1" / "1"
            candidates = [f"Q{q.index}", f"q{q.index}", str(q.index)]
            for col, norm_col in normalized_uploaded.items():
                if norm_col in candidates and col not in mapping:
                    matched_col = col
                    break
        else:
            # 按题面文本匹配
            norm_text = _normalize_text(q.text)
            for col, norm_col in normalized_uploaded.items():
                if norm_col == norm_text and col not in mapping:
                    matched_col = col
                    break

        if not matched_col:
            raise ValidationException(
                "请确保列名与题目编号一致",
                details={
                    "question_index": q.index,
                    "question_text": q.text,
                    "match_by": match_by.value,
                },
            )

        mapping[matched_col] = target_col

    return mapping


def _read_dataframe(content: bytes, ext: str) -> pd.DataFrame:
    """读取上传文件为 DataFrame。"""
    buffer = io.BytesIO(content)
    try:
        if ext == ".csv":
            # 尝试 UTF-8，失败回退 GBK
            try:
                return pd.read_csv(buffer, encoding="utf-8")
            except UnicodeDecodeError:
                buffer.seek(0)
                return pd.read_csv(buffer, encoding="gbk")
        elif ext == ".xlsx":
            return pd.read_excel(buffer, engine="openpyxl")
        elif ext == ".sav":
            # SPSS 格式：使用 spss_parser 解析后返回 DataFrame
            from app.services.spss_parser import parse_spss_sav
            parse_result = parse_spss_sav(content)
            return parse_result["dataframe"]
        else:
            raise ValidationException(f"不支持的文件格式：{ext}")
    except ValidationException:
        raise
    except Exception as e:
        raise ValidationException(f"文件解析失败：{str(e)}") from e


def _validate_and_transform(
    df: pd.DataFrame,
    questions: List[Question],
    match_by: DatasetTemplateMatchBy,
) -> pd.DataFrame:
    """校验并转换上传数据。

    1. 列名匹配
    2. 样本量校验
    3. 缺失值校验
    4. Likert 题转数值
    5. 反向题计分转换
    """
    if df.empty:
        raise ValidationException("文件内容为空")

    uploaded_columns = list(df.columns)
    column_mapping = _build_column_mapping(questions, uploaded_columns, match_by)

    # 样本量校验
    if len(df) < _MIN_SAMPLE_SIZE:
        raise ValidationException(
            f"样本量不足，建议至少 {_MIN_SAMPLE_SIZE} 条",
            details={"sample_size": len(df)},
        )

    # 选取匹配列并重命名为标准列名
    matched_cols = list(column_mapping.keys())
    df_matched = df[matched_cols].rename(columns=column_mapping)

    # 构建题目索引 → 题目信息的映射
    question_map = {q.index: q for q in questions}

    # Likert 题转数值并处理反向计分
    for col in df_matched.columns:
        idx_match = re.match(r"q(\d+)", col)
        if not idx_match:
            continue
        idx = int(idx_match.group(1))
        question = question_map.get(idx)
        if not question:
            continue

        if question.question_type in ("likert5", "likert7"):
            # 强制转数值
            df_matched[col] = pd.to_numeric(df_matched[col], errors="coerce")

            # 反向计分转换
            if question.is_reverse:
                max_score = 5 if question.question_type == "likert5" else 7
                df_matched[col] = max_score + 1 - df_matched[col]

    # 缺失值校验（仅针对匹配列）
    total_cells = df_matched.size
    missing_cells = df_matched.isna().sum().sum()
    missing_ratio = missing_cells / total_cells if total_cells > 0 else 0

    if missing_ratio > _MAX_MISSING_RATIO:
        raise ValidationException(
            "缺失值比例超过 30%，请检查数据",
            details={
                "missing_ratio": round(missing_ratio, 4),
                "missing_cells": int(missing_cells),
                "total_cells": int(total_cells),
            },
        )

    return df_matched


def _generate_template_buffer(
    questions: List[Question],
    format: DatasetTemplateFormat,
    match_by: DatasetTemplateMatchBy,
) -> Tuple[bytes, str, str]:
    """生成数据模板文件，返回 (文件字节, media_type, filename)。"""
    if match_by == DatasetTemplateMatchBy.INDEX:
        columns = [f"Q{q.index}" for q in questions]
    else:
        # 题面文本为用户可控内容，写入表头前做防公式注入净化
        columns = [_safe_cell(q.text) for q in questions]

    # 生成 3 行示例数据
    example_rows: List[List[Any]] = []
    for _ in range(3):
        row = []
        for q in questions:
            if q.question_type == "likert5":
                row.append(3)
            elif q.question_type == "likert7":
                row.append(4)
            elif q.question_type == "demographic":
                row.append("示例")
            else:
                row.append("")
        example_rows.append(row)

    df = pd.DataFrame(example_rows, columns=columns)

    buffer = io.BytesIO()
    if format == DatasetTemplateFormat.CSV:
        df.to_csv(buffer, index=False, encoding="utf-8-sig")
        media_type = "text/csv; charset=utf-8"
        filename = "template_real_data.csv"
    else:
        df.to_excel(buffer, index=False, engine="openpyxl")
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "template_real_data.xlsx"

    buffer.seek(0)
    return buffer.getvalue(), media_type, filename


@router.get(
    "/{project_id}/template",
    summary="下载数据模板",
    description="根据项目题目生成 .csv 或 .xlsx 数据模板，列名可选题目编号或题面。",
)
async def download_template(
    project_id: UUID,
    format: DatasetTemplateFormat = Query(DatasetTemplateFormat.XLSX),
    match_by: DatasetTemplateMatchBy = Query(DatasetTemplateMatchBy.TEXT),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """下载真实数据导入模板。"""
    from fastapi.responses import StreamingResponse

    await get_owned_project(db, project_id, current_user["id"])

    result = await db.execute(
        select(Question)
        .where(Question.project_id == project_id)
        .order_by(Question.index)
    )
    questions = result.scalars().all()
    if not questions:
        raise NotFoundException("项目下暂无题目，请先完成题目体检")

    file_bytes, media_type, filename = _generate_template_buffer(
        questions, format, match_by
    )

    return StreamingResponse(
        iter([file_bytes]),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post(
    "/{project_id}/import",
    response_model=ResponseModel[DatasetImportResponse],
    summary="导入真实回收数据",
    description="上传 .csv / .xlsx 真实回收数据，校验后存入 Dataset。",
)
async def import_real_data(
    project_id: UUID,
    request: Request,
    file: UploadFile = File(..., description="真实回收数据文件，支持 .csv / .xlsx"),
    match_by: DatasetTemplateMatchBy = Query(DatasetTemplateMatchBy.TEXT),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """导入真实回收数据。"""
    # 0. 校验并扣减免费额度
    await check_and_consume_quota(
        db,
        current_user["id"],
        "data_import",
        current_user["plan"],
        current_user.get("plan_expires_at"),
    )

    # 1. 验证项目存在且属于当前用户
    project = await get_owned_project(db, project_id, current_user["id"])

    # 2. 校验文件
    if not file.filename:
        raise ValidationException("文件名不能为空")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise ValidationException(
            f"不支持的文件格式：{ext}，仅支持 .csv / .xlsx / .sav"
        )

    content = await file.read()
    if len(content) > _MAX_UPLOAD_SIZE:
        raise ValidationException("文件大小超过 10MB 限制")

    if not content:
        raise ValidationException("文件内容为空")

    # 3. 校验文件头魔数（防止扩展名伪装攻击）
    _validate_file_magic(file.filename, content)

    # 4. 查询项目题目
    result = await db.execute(
        select(Question)
        .where(Question.project_id == project_id)
        .order_by(Question.index)
    )
    questions = result.scalars().all()
    if not questions:
        raise NotFoundException("项目下暂无题目，请先完成题目体检")

    # 4. 读取并校验数据
    df = _read_dataframe(content, ext)
    df_transformed = _validate_and_transform(df, questions, match_by)

    # 5. 持久化数据集
    dataset = Dataset(
        project_id=project_id,
        simulation_config_id=None,
        source=DatasetSource.REAL.value,
        sample_size=len(df_transformed),
        columns=df_transformed.columns.tolist(),
        data=df_transformed.to_dict(orient="records"),
    )
    db.add(dataset)

    # 6. 更新项目模式为 real（不改动状态，保持 inspected）
    project.mode = "real"

    # 7. 记录审计日志
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["DATA_IMPORT"],
        project_id=project_id,
        action_detail={
            "filename": file.filename,
            "sample_size": dataset.sample_size,
            "match_by": match_by.value,
            "columns": dataset.columns,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.flush()
    await db.refresh(dataset)

    return ResponseModel(
        data=DatasetImportResponse(
            id=dataset.id,
            project_id=dataset.project_id,
            source=DatasetSource(dataset.source),
            sample_size=dataset.sample_size,
            columns=dataset.columns,
            row_count=dataset.sample_size,
            preview=dataset.data[:10],
            created_at=dataset.created_at,
        )
    )


@router.get(
    "/{project_id}",
    response_model=ResponseModel[DatasetInfoResponse],
    summary="查看最新数据集",
    description="获取项目最新导入或生成的数据集摘要。",
)
async def get_latest_dataset(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """查询项目最新数据集摘要。"""
    await get_owned_project(db, project_id, current_user["id"])

    result = await db.execute(
        select(Dataset)
        .where(Dataset.project_id == project_id)
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise NotFoundException("未找到数据集")

    return ResponseModel(
        data=DatasetInfoResponse(
            id=dataset.id,
            project_id=dataset.project_id,
            source=DatasetSource(dataset.source),
            sample_size=dataset.sample_size,
            columns=dataset.columns,
            row_count=dataset.sample_size,
            preview=dataset.data[:10],
            created_at=dataset.created_at,
        )
    )
