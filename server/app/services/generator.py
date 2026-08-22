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
from app.core.statistics_constants import (
    STRENGTH_TO_R,
    STRENGTH_NOMINAL,
    LIKERT_DISCRETIZATION_COMPENSATION,
)


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

    # 确保协方差矩阵半正定：若存在负特征值，则裁剪到最近半正定矩阵
    # （处理自定义矩阵不一致导致非正定，避免 multivariate_normal 抛 500）
    corr = _clamp_to_psd(corr)

    mean = np.zeros(len(dimensions))
    data = rng.multivariate_normal(mean, corr, size=sample_size)

    return pd.DataFrame(data, columns=dimensions)


def _clamp_to_psd(corr: np.ndarray) -> np.ndarray:
    """把协方差/相关矩阵投影到最近的半正定矩阵（保留对称）。

    - 对称化（用户可能只填上三角）
    - 特征值裁剪到 >= 最小阈值后重组，并归一化到单位对角（相关矩阵要求对角为 1）
    """
    corr = (corr + corr.T) / 2.0
    np.fill_diagonal(corr, 1.0)
    eigvals, eigvecs = np.linalg.eigh(corr)
    if eigvals.min() >= 1e-6:
        return corr
    # 裁剪负特征值，保证数值稳定性
    clipped = np.maximum(eigvals, 1e-6)
    psd = (eigvecs * clipped) @ eigvecs.T
    # 归一化回单位对角（相关矩阵约束）
    d = np.sqrt(np.diag(psd))
    psd = psd / np.outer(d, d)
    np.fill_diagonal(psd, 1.0)
    return psd


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
