"""问卷星导出文件解析服务。

职责：
- 解析问卷星导出的 Excel/Word 文件，提取题目、选项、维度信息
- 转换为系统内部题目结构，供问卷体检接口使用

技术方案：方案 C（用户主动导出），无法律风险
设计依据：docs/w-功能-问卷星链接解析.md
"""
import io
import logging
import re
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


def parse_wjx_export(file_content: bytes, file_type: str) -> Dict[str, Any]:
    """解析问卷星导出的文件。

    Args:
        file_content: 文件二进制内容
        file_type: 文件类型（excel/word）

    Returns:
        {
            "questions": [题目列表],
            "dimensions": [维度列表],
            "warnings": [警告信息]
        }

    Raises:
        ValueError: 文件解析失败或格式不正确
    """
    if file_type == "excel":
        return _parse_wjx_excel(file_content)
    elif file_type == "word":
        return _parse_wjx_word(file_content)
    else:
        raise ValueError(f"不支持的文件类型: {file_type}")


def _parse_wjx_excel(file_content: bytes) -> Dict[str, Any]:
    """解析问卷星导出的 Excel 文件。

    问卷星导出格式示例：
    | 题号 | 题目 | 题型 | 选项 | 维度 |
    | Q1 | 您的性别 | 单选 | 男,女 | 人口学 |
    | Q2 | 学习动机强度 | 量表 | 1-5分 | 学习动机 |
    """
    try:
        df = pd.read_excel(io.BytesIO(file_content))
    except Exception as e:
        logger.error("问卷星 Excel 解析失败 | error=%s", e, exc_info=True)
        raise ValueError(f"Excel 文件解析失败：{str(e)}") from e

    if df.empty:
        raise ValueError("Excel 文件内容为空")

    # 标准化列名（问卷星可能用中文列名）
    column_mapping = _detect_wjx_columns(df)
    df = df.rename(columns=column_mapping)

    # 解析题目
    questions = []
    dimensions = set()
    warnings = []

    for idx, row in df.iterrows():
        try:
            question = _parse_question_row(row, idx)
            questions.append(question)
            if question.get("dimension"):
                dimensions.add(question["dimension"])
        except Exception as e:
            warnings.append(f"第 {idx + 1} 行解析失败: {str(e)}")
            logger.warning("问卷星第 %d 行解析失败 | error=%s", idx + 1, e)

    if not questions:
        raise ValueError("未能解析出任何题目，请检查文件格式")

    return {
        "questions": questions,
        "dimensions": list(dimensions),
        "warnings": warnings,
    }


def _parse_wjx_word(file_content: bytes) -> Dict[str, Any]:
    """解析问卷星导出的 Word 文件。

    问卷星导出格式示例：
    1. 您的性别 [单选题]
       ○ 男
       ○ 女

    2. 学习动机强度 [量表题]
       ○ 1 ○ 2 ○ 3 ○ 4 ○ 5
    """
    try:
        import docx
    except ImportError as exc:
        raise ValueError(
            "缺少 Word 解析依赖，请联系管理员安装 python-docx"
        ) from exc

    try:
        document = docx.Document(io.BytesIO(file_content))
        paragraphs = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    except Exception as e:
        logger.error("问卷星 Word 解析失败 | error=%s", e, exc_info=True)
        raise ValueError(f"Word 文件解析失败：{str(e)}") from e

    if not paragraphs:
        raise ValueError("Word 文件内容为空")

    questions = []
    dimensions = set()
    warnings = []

    current_question = None
    question_index = 0

    for para in paragraphs:
        # 检测题目行（如 "1. 您的性别 [单选题]"）
        question_match = re.match(r"^(\d+)[.、]\s*(.+?)\s*\[(.+?)\]$", para)
        if question_match:
            # 保存上一题
            if current_question:
                questions.append(current_question)
                if current_question.get("dimension"):
                    dimensions.add(current_question["dimension"])

            question_index += 1
            question_text = question_match.group(2)
            question_type_text = question_match.group(3)

            current_question = {
                "index": question_index,
                "number": f"Q{question_index}",
                "text": question_text,
                "type": _map_question_type(question_type_text),
                "options": [],
                "dimension": None,
                "is_reverse": False,
            }
            continue

        # 检测选项行（如 "○ 男" 或 "○ 1 ○ 2 ○ 3"）
        if current_question and "○" in para:
            options = re.findall(r"○\s*([^○]+)", para)
            options = [opt.strip() for opt in options if opt.strip()]
            current_question["options"].extend(options)

    # 保存最后一题
    if current_question:
        questions.append(current_question)
        if current_question.get("dimension"):
            dimensions.add(current_question["dimension"])

    if not questions:
        raise ValueError("未能解析出任何题目，请检查文件格式")

    return {
        "questions": questions,
        "dimensions": list(dimensions),
        "warnings": warnings,
    }


def _detect_wjx_columns(df: pd.DataFrame) -> Dict[str, str]:
    """检测问卷星导出的列名并映射到标准列名。"""
    column_mapping = {}
    for col in df.columns:
        col_lower = str(col).lower()
        if "题号" in col_lower or "编号" in col_lower:
            column_mapping[col] = "question_number"
        elif "题目" in col_lower or "内容" in col_lower:
            column_mapping[col] = "question_text"
        elif "题型" in col_lower or "类型" in col_lower:
            column_mapping[col] = "question_type"
        elif "选项" in col_lower or "答案" in col_lower:
            column_mapping[col] = "options"
        elif "维度" in col_lower or "分类" in col_lower:
            column_mapping[col] = "dimension"

    return column_mapping


def _safe_str_or_none(value: Any) -> Optional[str]:
    """将值安全转为字符串，NaN/None/空字符串返回 None。"""
    if value is None or pd.isna(value):
        return None
    result = str(value).strip()
    return result or None


def _parse_question_row(row: pd.Series, index: int) -> Dict[str, Any]:
    """解析单行题目数据。"""
    question_type = _map_question_type(str(row.get("question_type", "")))

    return {
        "index": index + 1,
        "number": str(row.get("question_number", f"Q{index + 1}")),
        "text": str(row.get("question_text", "")),
        "type": question_type,
        "options": _parse_options(row.get("options", "")),
        # dimension 可能为 NaN（空单元格），str(NaN)="nan" 会污染维度列表，
        # 需先排除 NaN 再转字符串
        "dimension": _safe_str_or_none(row.get("dimension")),
        "is_reverse": False,  # 问卷星导出不包含反向题信息
    }


def _map_question_type(wjx_type: str) -> str:
    """将问卷星题型映射到系统题型。"""
    type_mapping = {
        "单选题": "single_choice",
        "多选题": "multiple_choice",
        "量表题": "likert",
        "矩阵题": "matrix",
        "填空题": "open_ended",
        "单选": "single_choice",
        "多选": "multiple_choice",
        "量表": "likert",
        "矩阵": "matrix",
        "填空": "open_ended",
    }
    return type_mapping.get(wjx_type, "unknown")


def _parse_options(options_str: Any) -> List[str]:
    """解析选项字符串。"""
    if not options_str or pd.isna(options_str):
        return []

    # 问卷星用逗号或换行分隔选项
    options = []
    for opt in str(options_str).replace(",", "\n").split("\n"):
        opt = opt.strip()
        if opt:
            options.append(opt)

    return options
