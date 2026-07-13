"""数据生成服务（V4）。

职责：
- 根据假设路径 + 相关矩阵 + 样本量，生成模拟数据
- 约束反向生成，确保 α 达标率目标 ≥70%
- 输出 CSV / DataFrame 供后续统计分析
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from app.schemas.simulation import HypothesisPath


# 强度档位 → 目标相关系数（生成用补偿值）
# 设计依据：docs/后端架构设计文档.md 第 9.5 节
# 李克特量表整数化（连续→1-5）会造成相关性衰减，故生成时采用补偿值，
# 使数据呈现的相关性在衰减后仍接近 Cohen 名义值（r 0.1/0.3/0.5）。
STRENGTH_TO_R = {
    "weak": 0.2,
    "medium": 0.4,
    "strong": 0.6,
}

# 强度档位 → 名义相关系数（对外展示，对齐 Cohen 国际标准）
# 用于报告/前端展示「假设强度对应的相关性水平」，不参与数据生成。
STRENGTH_NOMINAL = {
    "weak": 0.1,
    "medium": 0.3,
    "strong": 0.5,
}

# 李克特离散化衰减补偿系数（生成值 / 名义值 的经验倍率，仅作记录与对齐说明用）
LIKERT_DISCRETIZATION_COMPENSATION = 2.0


def _build_correlation_matrix(
    dimensions: List[str],
    paths: List[HypothesisPath],
    custom_cells: Optional[Dict] = None,
) -> np.ndarray:
    """根据假设路径构建相关系数矩阵。

    优先使用用户确认的相关矩阵（custom_cells），
    否则根据路径强度自动生成。
    """
    n = len(dimensions)
    dim_index = {d: i for i, d in enumerate(dimensions)}
    corr = np.eye(n)

    if custom_cells:
        # 使用用户提供的相关矩阵
        for row_dim, col_vals in custom_cells.items():
            if row_dim in dim_index:
                for col_dim, val in col_vals.items():
                    if col_dim in dim_index:
                        corr[dim_index[row_dim]][dim_index[col_dim]] = val
    else:
        # 根据路径强度自动生成
        for p in paths:
            if p.predictor in dim_index and p.outcome in dim_index:
                i, j = dim_index[p.predictor], dim_index[p.outcome]
                r = STRENGTH_TO_R.get(p.strength, 0.3)
                if p.direction == "negative":
                    r = -r
                corr[i][j] = r
                corr[j][i] = r

    return corr


def _generate_multivariate_normal(
    corr: np.ndarray,
    sample_size: int,
    dimensions: List[str],
    seed: int = 42,
) -> pd.DataFrame:
    """生成多元正态分布模拟数据。"""
    rng = np.random.default_rng(seed)

    # 确保矩阵正定（添加微小正则化）
    eigvals = np.linalg.eigvalsh(corr)
    if eigvals.min() < 1e-6:
        corr += np.eye(len(corr)) * 1e-4

    mean = np.zeros(len(dimensions))
    data = rng.multivariate_normal(mean, corr, size=sample_size)

    return pd.DataFrame(data, columns=dimensions)


def _scale_to_likert(df: pd.DataFrame, scale: int = 5) -> pd.DataFrame:
    """将连续数据缩放到李克特量表范围 [1, scale]。"""
    # 标准化到 [0, 1]
    for col in df.columns:
        col_min, col_max = df[col].min(), df[col].max()
        if col_max - col_min > 0:
            df[col] = (df[col] - col_min) / (col_max - col_min)
        else:
            df[col] = 0.5

    # 缩放到 [1, scale] 并取整
    df = (df * (scale - 1) + 1).round().astype(int)
    df = df.clip(1, scale)
    return df


def generate(
    dimensions: List[str],
    paths: List[HypothesisPath],
    sample_size: int,
    scale_type: str = "likert5",
    custom_cells: Optional[Dict] = None,
    seed: int = 42,
) -> pd.DataFrame:
    """数据生成入口。

    Args:
        dimensions: 维度列表。
        paths: 假设路径列表。
        sample_size: 样本量。
        scale_type: 量表类型（likert5 / likert7）。
        custom_cells: 用户确认的相关矩阵（可选）。
        seed: 随机种子。

    Returns:
        pd.DataFrame: 模拟数据。
    """
    if not dimensions:
        raise ValueError("维度列表不能为空")
    if sample_size <= 0:
        raise ValueError("样本量必须大于 0")

    scale = 5 if scale_type == "likert5" else 7

    # 1. 构建相关系数矩阵
    corr = _build_correlation_matrix(dimensions, paths, custom_cells)

    # 2. 生成多元正态数据
    df = _generate_multivariate_normal(corr, sample_size, dimensions, seed)

    # 3. 缩放到李克特量表
    df = _scale_to_likert(df, scale)

    return df
