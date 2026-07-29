"""SPSS .sav 文件解析服务。

职责：
- 解析 SPSS .sav 文件，提取变量名、变量标签、值标签、缺失值定义
- 转换为系统内部数据格式，供 dataset import 接口使用

技术选型：pyreadstat（纯 Python，无需安装 SPSS）
设计依据：docs/x-功能-SPSS导入.md
"""
import logging
import os
import tempfile
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


def parse_spss_sav(file_content: bytes) -> Dict[str, Any]:
    """解析 SPSS .sav 文件。

    Args:
        file_content: .sav 文件二进制内容

    Returns:
        {
            "dataframe": pd.DataFrame,
            "variable_labels": Dict[str, str],
            "value_labels": Dict[str, Dict[str, str]],
            "missing_values": Dict[str, List],
            "metadata": Dict[str, Any]
        }

    Raises:
        ValueError: 文件解析失败或格式不正确
    """
    try:
        import pyreadstat
    except ImportError as exc:
        raise ValueError(
            "缺少 SPSS 解析依赖，请联系管理员安装 pyreadstat"
        ) from exc

    # pyreadstat.read_sav 仅接受文件路径（不支持 BytesIO），
    # 故将二进制内容写入临时文件再解析。
    fd, tmp_path = tempfile.mkstemp(suffix=".sav")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(file_content)
        try:
            df, meta = pyreadstat.read_sav(tmp_path)
        except Exception as e:
            logger.error("SPSS 文件解析失败 | error=%s", e, exc_info=True)
            raise ValueError(f"SPSS 文件解析失败：{str(e)}") from e
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    if df.empty:
        raise ValueError("SPSS 文件内容为空")

    # 提取元数据
    variable_labels = meta.column_names_to_labels or {}
    value_labels = meta.variable_value_labels or {}
    missing_values = meta.missing_ranges or {}

    return {
        "dataframe": df,
        "variable_labels": variable_labels,
        "value_labels": value_labels,
        "missing_values": missing_values,
        "metadata": {
            "file_label": getattr(meta, "file_label", None),
            "creation_time": getattr(meta, "creation_time", None),
            "variable_count": len(df.columns),
            "sample_size": len(df),
        },
    }


def convert_to_internal_format(
    parse_result: Dict[str, Any],
    dimension_mapping: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """将 SPSS 解析结果转换为系统内部数据格式。

    Args:
        parse_result: parse_spss_sav 的返回值
        dimension_mapping: 变量到维度的映射（可选，由用户后续补充）

    Returns:
        {
            "columns": [列名列表],
            "column_info": [列详细信息],
            "data": [数据行列表],
            "meta": [元数据]
        }
    """
    df = parse_result["dataframe"]
    variable_labels = parse_result["variable_labels"]
    value_labels = parse_result["value_labels"]

    # 构建列信息
    columns_info = []
    for col in df.columns:
        # 值标签可能键是数值或字符串，统一转为字符串
        col_value_labels = value_labels.get(col, {})
        normalized_value_labels = {
            str(k): str(v) for k, v in col_value_labels.items()
        }

        col_info = {
            "name": col,
            # 标签可能为 None 或空字符串（pyreadstat 对无标签列返回 None），
            # 此时回退为列名
            "label": variable_labels.get(col) or str(col),
            "type": "numeric" if pd.api.types.is_numeric_dtype(df[col]) else "string",
            "value_labels": normalized_value_labels,
        }
        columns_info.append(col_info)

    # 转换数据为字典列表（NaN 转为 None）
    # 先转为 object 类型，使 None 能正确替换 NaN（float64 列无法存储 None）
    data = df.astype(object).where(pd.notnull(df), None).to_dict(orient="records")

    # 构建元数据
    meta = {
        "sample_size": len(df),
        "variable_count": len(columns_info),
        "source_format": "spss",
    }

    return {
        "columns": [c["name"] for c in columns_info],
        "column_info": columns_info,
        "data": data,
        "meta": meta,
    }
