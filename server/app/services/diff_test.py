"""差异检验方法决策树（P1，后端架构文档 9.6）。

根据自变量/因变量类型 + 组数自动选择检验方法：

| 自变量     | 因变量 | 组数 | 推荐方法          |
|-----------|--------|------|------------------|
| 分类       | 连续   | 2    | 独立样本 t 检验   |
| 分类       | 连续   | ≥3   | 单因素 ANOVA      |
| 分类       | 分类   | -    | 卡方检验          |
| 连续       | 连续   | -    | Pearson 相关      |
| 连续×多   | 连续   | -    | 线性回归          |

决策规则集中在 DECISION_TABLE，不在调用方硬编码。
"""
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from scipy import stats as sp_stats

# 决策规则表（后端架构文档 9.6）
# groups_min: 自变量为分类时，组数下限（用于区分 t vs ANOVA）
DECISION_TABLE: List[Dict] = [
    {
        "iv_type": "categorical",
        "dv_type": "continuous",
        "groups_max": 2,
        "method": "independent_t",
        "method_name": "独立样本 t 检验",
    },
    {
        "iv_type": "categorical",
        "dv_type": "continuous",
        "groups_min": 3,
        "method": "anova",
        "method_name": "单因素方差分析（ANOVA）",
    },
    {
        "iv_type": "categorical",
        "dv_type": "categorical",
        "method": "chi_square",
        "method_name": "卡方检验",
    },
    {
        "iv_type": "continuous",
        "dv_type": "continuous",
        "method": "pearson",
        "method_name": "Pearson 积差相关",
    },
    {
        "iv_type": "continuous_multi",
        "dv_type": "continuous",
        "method": "linear_regression",
        "method_name": "多元线性回归",
    },
]

# 效应量分档（Cohen 名义值，对齐 statistics_constants 口径）
EFFECT_SIZE_GRADES = [
    (0.5, "大"),
    (0.3, "中"),
    (0.1, "小"),
    (0.0, "可忽略"),
]


def select_method(
    iv_type: str,
    dv_type: str,
    group_count: Optional[int] = None,
    iv_count: int = 1,
) -> str:
    """根据变量类型与组数选择检验方法。

    Args:
        iv_type: 自变量类型 "categorical" | "continuous"
        dv_type: 因变量类型 "categorical" | "continuous"
        group_count: 分类自变量的组数（iv_type=categorical 时有效）
        iv_count: 自变量个数，>1 视为 continuous_multi

    Returns:
        方法名：independent_t / anova / chi_square / pearson / linear_regression
    """
    # 多个连续自变量 → 回归
    if iv_count > 1 and iv_type == "continuous" and dv_type == "continuous":
        return "linear_regression"

    if iv_type == "categorical" and dv_type == "continuous":
        if group_count is not None and group_count >= 3:
            return "anova"
        return "independent_t"
    if iv_type == "categorical" and dv_type == "categorical":
        return "chi_square"
    if iv_type == "continuous" and dv_type == "continuous":
        return "pearson"
    # 兜底：无法匹配时用 Pearson（最通用）
    return "pearson"


def get_method_name(method: str) -> str:
    """方法代码 → 中文名。"""
    for rule in DECISION_TABLE:
        if rule["method"] == method:
            return rule["method_name"]
    return method


def infer_type(series: pd.Series, cat_threshold: int = 10) -> str:
    """推断变量类型。

    规则：唯一值数量 ≤ threshold 且为整数/字符串/布尔型 → categorical，
    否则 continuous。维度均值（浮点且唯一值多）默认连续；
    李克特整数、性别编码、分组标签等视为分类。
    """
    if series is None or series.empty:
        return "continuous"
    nunique = int(series.nunique())
    if nunique <= cat_threshold and (
        pd.api.types.is_integer_dtype(series)
        or pd.api.types.is_object_dtype(series)
        or pd.api.types.is_bool_dtype(series)
    ):
        return "categorical"
    return "continuous"


def _grade_effect_size(value: float) -> str:
    """效应量分档（Cohen 名义值）。"""
    for threshold, label in EFFECT_SIZE_GRADES:
        if abs(value) >= threshold:
            return label
    return "可忽略"


# ---------- 各检验方法实现 ----------


def _independent_t_test(
    df: pd.DataFrame, iv: str, dv: str
) -> Optional[Dict]:
    """独立样本 t 检验 + Cohen's d。"""
    groups = df[iv].dropna().unique()
    if len(groups) < 2:
        return None
    g1 = df[df[iv] == groups[0]][dv].dropna()
    g2 = df[df[iv] == groups[1]][dv].dropna()
    if len(g1) < 2 or len(g2) < 2:
        return None
    t_stat, p_value = sp_stats.ttest_ind(g1, g2, equal_var=False)
    # Cohen's d
    n1, n2 = len(g1), len(g2)
    pooled_std = np.sqrt(
        ((n1 - 1) * g1.var(ddof=1) + (n2 - 1) * g2.var(ddof=1)) / (n1 + n2 - 2)
    )
    d = (g1.mean() - g2.mean()) / pooled_std if pooled_std > 0 else 0.0
    return {
        "statistic": float(round(t_stat, 4)),
        "p_value": float(round(p_value, 5)),
        "effect_size": float(round(abs(d), 3)),
        "effect_size_name": "Cohen's d",
        "effect_size_grade": _grade_effect_size(abs(d)),
    }


def _anova_test(df: pd.DataFrame, iv: str, dv: str) -> Optional[Dict]:
    """单因素 ANOVA + eta squared。"""
    groups = df[iv].dropna().unique()
    if len(groups) < 2:
        return None
    samples = [df[df[iv] == g][dv].dropna() for g in groups]
    samples = [s for s in samples if len(s) >= 2]
    if len(samples) < 2:
        return None
    f_stat, p_value = sp_stats.f_oneway(*samples)
    # eta squared = SS_between / SS_total
    grand_mean = df[dv].mean()
    ss_between = sum(
        len(s) * (s.mean() - grand_mean) ** 2 for s in samples
    )
    ss_total = sum((df[dv] - grand_mean) ** 2)
    eta_sq = ss_between / ss_total if ss_total > 0 else 0.0
    return {
        "statistic": float(round(f_stat, 4)),
        "p_value": float(round(p_value, 5)),
        "effect_size": float(round(eta_sq, 3)),
        "effect_size_name": "η²",
        "effect_size_grade": _grade_effect_size(eta_sq),
    }


def _chi_square_test(df: pd.DataFrame, iv: str, dv: str) -> Optional[Dict]:
    """卡方检验 + Cramer's V。"""
    try:
        contingency = pd.crosstab(df[iv], df[dv])
    except Exception:
        return None
    if contingency.size == 0:
        return None
    chi2, p_value, dof, _ = sp_stats.chi2_contingency(contingency)
    n = contingency.values.sum()
    r, k = contingency.shape
    min_dim = min(r - 1, k - 1)
    cramers_v = np.sqrt(chi2 / (n * min_dim)) if n > 0 and min_dim > 0 else 0.0
    return {
        "statistic": float(round(chi2, 4)),
        "p_value": float(round(p_value, 5)),
        "dof": int(dof),
        "effect_size": float(round(cramers_v, 3)),
        "effect_size_name": "Cramér's V",
        "effect_size_grade": _grade_effect_size(cramers_v),
    }


def _pearson_test(df: pd.DataFrame, iv: str, dv: str) -> Optional[Dict]:
    """Pearson 相关。"""
    sub = df[[iv, dv]].dropna()
    if len(sub) < 3:
        return None
    r, p_value = sp_stats.pearsonr(sub[iv], sub[dv])
    return {
        "statistic": float(round(r, 4)),
        "p_value": float(round(p_value, 5)),
        "effect_size": float(round(abs(r), 3)),
        "effect_size_name": "r",
        "effect_size_grade": _grade_effect_size(abs(r)),
    }


def _linear_regression(
    df: pd.DataFrame, ivs: List[str], dv: str
) -> Optional[Dict]:
    """多元线性回归（最小二乘 + R²）。"""
    sub = df[ivs + [dv]].dropna()
    if len(sub) < len(ivs) + 2:
        return None
    X = sub[ivs].values
    y = sub[dv].values
    # 加截距项
    X_design = np.column_stack([X, np.ones(len(X))])
    try:
        coef, residuals, _, _ = np.linalg.lstsq(X_design, y, rcond=None)
    except np.linalg.LinAlgError:
        return None
    y_pred = X_design @ coef
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - y.mean()) ** 2)
    r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    # F 检验
    n, k = len(y), len(ivs)
    if n - k - 1 > 0 and ss_res > 0:
        f_stat = (ss_tot - ss_res) / k / (ss_res / (n - k - 1))
        p_value = 1 - sp_stats.f.cdf(f_stat, k, n - k - 1)
    else:
        f_stat, p_value = 0.0, 1.0
    return {
        "statistic": float(round(f_stat, 4)),
        "p_value": float(round(p_value, 5)),
        "effect_size": float(round(r_squared, 3)),
        "effect_size_name": "R²",
        "effect_size_grade": _grade_effect_size(r_squared),
        "coefficients": {
            ivs[i]: float(round(coef[i], 4)) for i in range(len(ivs))
        },
    }


# ---------- 统一入口 ----------


def run_diff_tests(
    df: pd.DataFrame,
    paths: List[Dict],
) -> List[Dict]:
    """对假设路径批量执行差异检验。

    Args:
        df: 数据集（含维度列）。
        paths: 假设路径列表，每项含 predictor/outcome/direction/strength。

    Returns:
        各路径的检验结果列表。每项含 predictor/outcome/method/statistic/
        p_value/effect_size/significant/interpretation。
    """
    results: List[Dict] = []

    # 收集连续自变量，用于回归（多路径指向同一 outcome 时合并）
    outcome_ivs: Dict[str, List[str]] = {}
    for p in paths:
        outcome_ivs.setdefault(p["outcome"], []).append(p["predictor"])

    for path in paths:
        iv = path["predictor"]
        dv = path["outcome"]
        if iv not in df.columns or dv not in df.columns:
            results.append({
                "predictor": iv,
                "outcome": dv,
                "method": None,
                "method_name": None,
                "error": f"变量 {iv} 或 {dv} 不在数据集中",
            })
            continue

        iv_type = infer_type(df[iv])
        dv_type = infer_type(df[dv])
        group_count = int(df[iv].nunique()) if iv_type == "categorical" else None

        # 多个连续自变量指向同一 outcome → 回归
        ivs_for_outcome = outcome_ivs.get(dv, [])
        iv_count = sum(
            1 for x in ivs_for_outcome
            if x in df.columns and infer_type(df[x]) == "continuous"
        )
        method = select_method(
            iv_type, dv_type, group_count, iv_count=iv_count
        )

        test_result: Optional[Dict] = None
        if method == "independent_t":
            test_result = _independent_t_test(df, iv, dv)
        elif method == "anova":
            test_result = _anova_test(df, iv, dv)
        elif method == "chi_square":
            test_result = _chi_square_test(df, iv, dv)
        elif method == "pearson":
            test_result = _pearson_test(df, iv, dv)
        elif method == "linear_regression":
            test_result = _linear_regression(
                df, ivs_for_outcome, dv
            )

        if test_result is None:
            results.append({
                "predictor": iv,
                "outcome": dv,
                "method": method,
                "method_name": get_method_name(method),
                "error": "数据不足或组数不够，无法完成检验",
            })
            continue

        significant = test_result["p_value"] < 0.05
        direction = path.get("direction", "")
        strength = path.get("strength", "")
        interpretation = _build_interpretation(
            method, test_result, significant, direction, strength
        )

        results.append({
            "predictor": iv,
            "outcome": dv,
            "method": method,
            "method_name": get_method_name(method),
            "iv_type": iv_type,
            "dv_type": dv_type,
            "group_count": group_count,
            "direction": direction,
            "strength": strength,
            "statistic": test_result["statistic"],
            "p_value": test_result["p_value"],
            "effect_size": test_result["effect_size"],
            "effect_size_name": test_result["effect_size_name"],
            "effect_size_grade": test_result["effect_size_grade"],
            "significant": bool(significant),
            "interpretation": interpretation,
            **{
                k: v for k, v in test_result.items()
                if k not in ("statistic", "p_value", "effect_size",
                             "effect_size_name", "effect_size_grade")
            },
        })

    return results


def _build_interpretation(
    method: str,
    result: Dict,
    significant: bool,
    direction: str,
    strength: str,
) -> str:
    """生成自然语言解读。"""
    name = get_method_name(method)
    p_str = f"p={'<0.001' if result['p_value'] < 0.001 else round(result['p_value'], 3)}"
    sig = "显著" if significant else "不显著"
    es = result["effect_size"]
    es_name = result["effect_size_name"]
    es_grade = result["effect_size_grade"]

    base = (
        f"{name}结果：{result['statistic']}，{p_str}（{sig}），"
        f"{es_name}={es}（效应量{es_grade}）"
    )

    if method == "pearson":
        r_val = result["statistic"]
        dir_text = "正向" if r_val > 0 else "负向"
        return f"{base}。{direction or ''}相关方向为{dir_text}。"
    if method == "linear_regression":
        coefs = result.get("coefficients", {})
        coef_text = "、".join(
            f"{k}={v}" for k, v in coefs.items()
        )
        return f"{base}。回归系数：{coef_text}。"
    return f"{base}。"
