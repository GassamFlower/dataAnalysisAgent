"""统计分析服务（V5）。

职责：
- 信度分析：Cronbach's α
- 效度分析：KMO + Bartlett 球形检验
- 输出各维度信效度结果
"""
import logging

import numpy as np
import pandas as pd
from typing import List, Dict, Tuple

from factor_analyzer import FactorAnalyzer
from factor_analyzer.factor_analyzer import calculate_kmo, calculate_bartlett_sphericity

from app.core.statistics_constants import is_passed, grade, build_grade_label

logger = logging.getLogger(__name__)


def _cronbachs_alpha(data: pd.DataFrame) -> float:
    """计算 Cronbach's α 系数。"""
    n_items = data.shape[1]
    if n_items < 2:
        return 0.0

    item_vars = data.var(axis=0, ddof=1)
    total_var = data.sum(axis=1).var(ddof=1)

    if total_var == 0:
        return 0.0

    alpha = (n_items / (n_items - 1)) * (1 - item_vars.sum() / total_var)
    return alpha


def _kmo_per_dimension(data: pd.DataFrame, dimension: str) -> float:
    """计算 KMO 值；失败时记日志并返回 0.0（保守判为不合格），避免静默。"""
    try:
        kmo_all, kmo_model = calculate_kmo(data)
        return kmo_model
    except Exception as exc:  # noqa: BLE001
        logger.warning("维度 %s KMO 计算失败，按 0.0 保守处理 | error=%s", dimension, exc, exc_info=True)
        return 0.0


def _bartlett_p_value(data: pd.DataFrame, dimension: str) -> float:
    """计算 Bartlett 球形检验 p 值；失败时记日志并返回 None（标记不可用），由调用方区分。"""
    try:
        chi_square, p_value = calculate_bartlett_sphericity(data)
        return p_value
    except Exception as exc:  # noqa: BLE001
        logger.warning("维度 %s Bartlett 检验计算失败（标记不可用）| error=%s", dimension, exc, exc_info=True)
        return np.nan


def analyze_reliability(
    df: pd.DataFrame,
    dimensions: List[str],
    dimension_items: Dict[str, List[str]]
) -> List[Dict]:
    """信效度分析入口。

    Args:
        df: 模拟数据（维度均值已计算）。
        dimensions: 维度列表。
        dimension_items: 每个维度对应的题目列名列表。

    Returns:
        List[Dict]: 各维度信效度结果。
    """
    results = []

    for dim in dimensions:
        items = dimension_items.get(dim, [])
        if not items:
            continue

        # 提取该维度的题目数据
        dim_data = df[items] if all(col in df.columns for col in items) else None
        if dim_data is None or dim_data.empty:
            continue

        alpha = _cronbachs_alpha(dim_data)
        kmo = _kmo_per_dimension(dim_data, dim)
        bartlett_p = _bartlett_p_value(dim_data, dim)

        # 计算是否完整（Bartlett 计算失败标记为不可用，不参与伪"通过/失败"判定）
        bartlett_ok = not (isinstance(bartlett_p, float) and np.isnan(bartlett_p))
        effective_bartlett_p = bartlett_p if bartlett_ok else 1.0

        # 通过判定：α≥0.7 且 KMO≥0.5 且 Bartlett p<0.05（阈值来自 statistics_constants）
        passed = (
            is_passed("alpha", alpha)
            and is_passed("kmo", kmo)
            and (bartlett_ok and is_passed("bartlett_p", effective_bartlett_p))
        )

        # 分档标签（等级 + 论文措辞），供报告/前端展示
        alpha_grade, alpha_wording = grade("alpha", alpha)
        kmo_grade, kmo_wording = grade("kmo", kmo)
        bartlett_grade, bartlett_wording = (grade("bartlett_p", effective_bartlett_p) if bartlett_ok else ("不可用", "无法计算"))

        results.append({
            "dimension": dim,
            "alpha": float(round(alpha, 3)),
            "alpha_grade": alpha_grade,
            "alpha_wording": alpha_wording,
            "kmo": float(round(kmo, 3)),
            "kmo_grade": kmo_grade,
            "kmo_wording": kmo_wording,
            "bartlett_p_value": float(round(effective_bartlett_p, 5)),
            "bartlett_grade": bartlett_grade,
            "bartlett_wording": bartlett_wording,
            "passed": bool(passed),
            "calc_error": None if bartlett_ok else "bartlett_unavailable",
        })

    return results
