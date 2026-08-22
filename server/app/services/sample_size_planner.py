"""样本量规划引擎（F-RPT-008）。

功效分析闭式解（确定性计算，无 LLM、免费能力）：
- 相关分析：N = (z(1-α/2) + z(1-β))² / (0.5·ln((1+r)/(1-r)))² + 3（Fisher z 变换）
- 独立样本 t 检验：每组 n = 2·(z(1-α/2) + z(1-β))² / d²
- 配对 t 检验：n = (z(1-α/2) + z(1-β))² / dz²（配对差值的效应量 dz）
- 单因素 ANOVA：n = (z(1-α/2) + z(1-β))² / f²（Cohen f，每组样本量）
- 回归分析：n ≥ 10×k（SAMPLE_PER_IV 经验法则，至少 30）
- 分层抽样：n = 基础样本量 × 设计效应（DEFF=1+0.05×(层数-1)）

阈值唯一来源：app/core/statistics_constants.py
设计依据：docs/b-功能清单.md F-RPT-008
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional

from scipy.stats import norm

from app.core.statistics_constants import (
    PLANNER_ALPHA_DEFAULT,
    PLANNER_MIN_TARGET,
    PLANNER_POWER_DEFAULT,
    SAMPLE_PER_IV,
    T_TEST_DEFAULT_D,
    grade_effect_size,
)

ANALYSIS_LABELS: Dict[str, str] = {
    "correlation": "相关分析",
    "t_test": "独立样本 t 检验",
    "paired_t_test": "配对样本 t 检验",
    "anova": "单因素方差分析（ANOVA）",
    "regression": "多元回归分析",
    "stratified": "分层抽样",
}

VERDICT_LABELS: Dict[str, str] = {
    "sufficient": "达标",
    "marginal": "够功效但低于建议下限",
    "insufficient": "不足",
    "unknown": "待确认",
}


def _z_sum(alpha: float, power: float) -> float:
    """双侧检验临界值之和：z(1-α/2) + z(1-β)。"""
    return norm.ppf(1 - alpha / 2) + norm.ppf(power)


def required_n_correlation(
    r: float,
    alpha: float = PLANNER_ALPHA_DEFAULT,
    power: float = PLANNER_POWER_DEFAULT,
) -> int:
    """相关分析所需总样本量（Fisher z 变换闭式解）。"""
    if not 0 < abs(r) < 1:
        raise ValueError("相关分析效应量 r 需在 (-1, 1) 内且不能为 0")
    zr = 0.5 * math.log((1 + abs(r)) / (1 - abs(r)))
    n = (_z_sum(alpha, power) / zr) ** 2 + 3
    return max(int(math.ceil(n)), 2)


def required_n_t_test(
    d: float,
    alpha: float = PLANNER_ALPHA_DEFAULT,
    power: float = PLANNER_POWER_DEFAULT,
) -> int:
    """独立样本 t 检验每组所需样本量。"""
    if d <= 0:
        raise ValueError("差异检验效应量 d 需大于 0")
    n_per = 2 * (_z_sum(alpha, power) / d) ** 2
    return max(int(math.ceil(n_per)), 2)


def required_n_regression(predictors: int) -> int:
    """回归分析所需总样本量（n ≥ 10×k 经验法则，至少 30）。"""
    if predictors < 1:
        raise ValueError("自变量个数需大于等于 1")
    return max(SAMPLE_PER_IV * predictors, 30)


def required_n_paired(
    dz: float,
    alpha: float = PLANNER_ALPHA_DEFAULT,
    power: float = PLANNER_POWER_DEFAULT,
) -> int:
    """配对样本 t 检验所需样本量（配对差值效应量 dz）。

    公式：n = (z(1-α/2) + z(1-β))² / dz²
    """
    if dz <= 0:
        raise ValueError("配对检验效应量 dz 需大于 0")
    n = (_z_sum(alpha, power) / dz) ** 2
    return max(int(math.ceil(n)), 2)


def required_n_anova(
    f: float,
    alpha: float = PLANNER_ALPHA_DEFAULT,
    power: float = PLANNER_POWER_DEFAULT,
) -> int:
    """单因素 ANOVA 每组所需样本量（Cohen f 效应量）。

    公式：每组 n = (z(1-α/2) + z(1-β))² / f²
    """
    if f <= 0:
        raise ValueError("ANOVA 效应量 f 需大于 0")
    n_per = (_z_sum(alpha, power) / f) ** 2
    return max(int(math.ceil(n_per)), 2)


def required_n_stratified(
    base_n: int,
    strata: int = 2,
) -> int:
    """分层抽样所需总样本量（设计效应 DEFF 校正）。

    公式：n = base_n × (1 + 0.05 × (strata - 1))
    分层越多，设计效应越大，所需样本量越多。
    """
    if strata < 1:
        raise ValueError("分层数需大于等于 1")
    deff = 1 + 0.05 * (strata - 1)
    n = base_n * deff
    return max(int(math.ceil(n)), 2)


def build_plan(
    analysis_type: str,
    effect_size: float,
    alpha: float,
    power: float,
    *,
    effect_source: str = "default",
    predictors: Optional[int] = None,
    groups: Optional[int] = None,
    strata: Optional[int] = None,
    planned_n: Optional[int] = None,
) -> Dict[str, object]:
    """构建样本量规划结果（确定性规则）。

    Args:
        analysis_type: correlation / t_test / paired_t_test / anova / regression / stratified
        effect_size: 效应量（correlation 为 r，t_test 为 d，paired_t_test 为 dz，
                      anova 为 f，regression/stratified 忽略）
        alpha: 显著性水平
        power: 检验功效
        effect_source: user（用户手填）/ simulation（取自预演矩阵）/ default（默认中等效应）
        predictors: 回归自变量个数
        groups: ANOVA 组数
        strata: 分层抽样层数
        planned_n: 计划回收样本量（可选，用于判定）

    Returns:
        规划结果 dict，含 required_n / recommended_n / verdict / guidance 等。
    """
    if analysis_type not in ANALYSIS_LABELS:
        raise ValueError(f"未知分析类型: {analysis_type}")
    if not 0 < alpha < 1:
        raise ValueError("显著性水平 alpha 需在 (0, 1) 内")
    if not 0.5 < power < 1:
        raise ValueError("检验功效 power 需在 (0.5, 1) 内")

    if analysis_type == "correlation":
        if not 0 < abs(effect_size) < 1:
            raise ValueError("相关分析效应量 r 需在 (-1, 1) 内且不能为 0")
        required = required_n_correlation(effect_size, alpha, power)
        per_group: Optional[int] = None
        effect_label = f"r={effect_size:.2f}（{grade_effect_size(abs(effect_size))}效应）"
    elif analysis_type == "t_test":
        if effect_size <= 0:
            raise ValueError("差异检验效应量 d 需大于 0")
        per_group = required_n_t_test(effect_size, alpha, power)
        required = per_group * 2
        effect_label = f"d={effect_size:.2f}（{grade_effect_size(effect_size)}效应）"
    elif analysis_type == "paired_t_test":
        if effect_size <= 0:
            raise ValueError("配对检验效应量 dz 需大于 0")
        required = required_n_paired(effect_size, alpha, power)
        per_group = None
        effect_label = f"dz={effect_size:.2f}（{grade_effect_size(effect_size)}效应）"
    elif analysis_type == "anova":
        if effect_size <= 0:
            raise ValueError("ANOVA 效应量 f 需大于 0")
        if not groups or groups < 2:
            raise ValueError("ANOVA 需提供组数（≥2）")
        per_group = required_n_anova(effect_size, alpha, power)
        required = per_group * groups
        effect_label = f"f={effect_size:.2f}（{grade_effect_size(effect_size)}效应），{groups} 组"
    elif analysis_type == "stratified":
        if not strata or strata < 1:
            strata = 2
        # 分层抽样以代表性下限为基准样本量，再按设计效应校正
        base_n = PLANNER_MIN_TARGET
        required = required_n_stratified(base_n, strata)
        per_group = None
        effect_label = f"{strata} 层（设计效应校正）"
    else:
        if not predictors or predictors < 1:
            raise ValueError("回归分析需提供自变量个数")
        required = required_n_regression(predictors)
        per_group = None
        effect_label = f"k={predictors} 个自变量"

    recommended = max(required, PLANNER_MIN_TARGET)

    verdict = "unknown"
    shortfall = 0
    if planned_n is not None:
        if planned_n >= recommended:
            verdict = "sufficient"
        elif planned_n >= required:
            verdict = "marginal"
        else:
            verdict = "insufficient"
        shortfall = max(recommended - planned_n, 0)

    guidance = _build_guidance(
        analysis_type, required, recommended, verdict, planned_n, shortfall
    )

    return {
        "analysis_type": analysis_type,
        "analysis_label": ANALYSIS_LABELS[analysis_type],
        "effect_size": round(effect_size, 3),
        "effect_label": effect_label,
        "effect_source": effect_source,
        "alpha": alpha,
        "power": power,
        "required_n": required,
        "per_group_n": per_group,
        "representative_min": PLANNER_MIN_TARGET,
        "recommended_n": recommended,
        "planned_n": planned_n,
        "verdict": verdict,
        "verdict_label": VERDICT_LABELS[verdict],
        "shortfall": shortfall,
        "guidance": guidance,
        "one_liner": guidance[0] if guidance else "",
    }


def _build_guidance(
    analysis_type: str,
    required: int,
    recommended: int,
    verdict: str,
    planned_n: Optional[int],
    shortfall: int,
) -> List[str]:
    """规则模板生成「说人话」建议（确定性，无 LLM）。"""
    type_label = ANALYSIS_LABELS[analysis_type]
    lines: List[str] = []

    if required >= recommended:
        lines.append(
            f"{type_label}按此效应量需 N={required}，已达到代表性建议下限，建议回收目标 N={required}。"
        )
    else:
        lines.append(
            f"{type_label}按此效应量公式需 N={required}，但代表性建议下限为 N={recommended}，建议回收目标 N={recommended}（兼顾统计功效与样本结构）。"
        )

    if verdict == "sufficient":
        lines.append(f"计划回收 N={planned_n} ≥ 建议目标，可以开始回收。")
    elif verdict == "marginal":
        lines.append(
            f"计划回收 N={planned_n} 已满足检验功效（N≥{required}），但低于代表性建议下限，结论推广时需在报告中说明样本量局限。"
        )
    elif verdict == "insufficient":
        lines.append(
            f"计划回收 N={planned_n} 不足：距建议目标还差约 {shortfall} 份，建议补足后再回收（本工具不提供样本收集/投放服务）。"
        )

    return lines
