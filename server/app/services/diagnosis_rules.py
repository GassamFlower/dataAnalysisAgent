"""诊断知识库（翻车点 → issue 匹配规则）。

职责：
- 将模板包「信效度翻车点 TOP10」结构化为确定性规则
- 诊断时先规则匹配（必出、稳定），再由 LLM 补充自然语言原因
- 规则保证高频翻车点不漏，LLM 负责语境化表达

设计依据：docs/后端架构设计文档.md 第 9.3 节
来源：数据分析模板包「信效度速查表」翻车点 TOP10
"""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from app.core.statistics_constants import THRESHOLDS


def _is_reverse_unreversed(project_meta: Dict, reliability_results: List[Dict]) -> bool:
    """#1 反向题没反转：存在反向题标记但 reliability_results 中无反转处理标志。"""
    has_reverse = bool(project_meta.get("has_reverse_items"))
    reversed_done = bool(project_meta.get("reverse_scored"))
    return has_reverse and not reversed_done


def _is_mixed_dim_alpha(project_meta: Dict, reliability_results: List[Dict]) -> bool:
    """#2 混维度算 α：仅报整体 α，未按维度拆分。

    reliability_results 为空或仅 1 行（整体）且 project_meta 有多维度 → 命中。
    """
    dim_count = project_meta.get("dimension_count", 0)
    if dim_count <= 1:
        return False
    # reliability_results 应按维度分行，若行数 < 维度数 → 说明部分维度未单独计算
    return len(reliability_results) < dim_count


def _is_only_overall_alpha(project_meta: Dict, reliability_results: List[Dict]) -> bool:
    """#3 只报整体 α 不报分维度：reliability_results 中 dimension == '整体' 占主导。"""
    if not reliability_results:
        return False
    dim_count = project_meta.get("dimension_count", 0)
    # 有多个维度但结果只有 1 条，或结果中维度名命中 "整体/总量表"
    if dim_count > 1 and len(reliability_results) == 1:
        return True
    return any(str(r.get("dimension", "")).lower() in {"整体", "总量表", "overall", "total"} for r in reliability_results)


def _is_kmo_below_threshold(project_meta: Dict, reliability_results: List[Dict]) -> bool:
    """#4 KMO<0.5 仍强行 EFA。"""
    kmo_threshold = THRESHOLDS["kmo"]
    for r in reliability_results:
        kmo = r.get("kmo")
        if kmo is not None and float(kmo) < kmo_threshold:
            return True
    return False


def _is_low_loading_not_dropped(project_meta: Dict, reliability_results: List[Dict]) -> bool:
    """#5 载荷<0.4 不删题：reliability_results 或 project_meta 携带 loading 信息。"""
    loading_threshold = THRESHOLDS["loading"]
    # 检查每维度下的 loadings 列表
    for r in reliability_results:
        loadings = r.get("loadings") or []
        for ld in loadings:
            try:
                if abs(float(ld)) < loading_threshold:
                    return True
            except (TypeError, ValueError):
                continue
    # project_meta 层面也查
    for ld in (project_meta.get("loadings") or []):
        try:
            if abs(float(ld)) < loading_threshold:
                return True
        except (TypeError, ValueError):
            continue
    return False


def _is_cross_factor_loading(project_meta: Dict, reliability_results: List[Dict]) -> bool:
    """#6 一题跨多因子：跨因子载荷差 < 0.2（载荷矩阵提供时检测）。"""
    loading_matrix = project_meta.get("loading_matrix") or []
    for row in loading_matrix:
        # row 为某题在各因子上的载荷列表
        try:
            sorted_loads = sorted([abs(float(x)) for x in row], reverse=True)
            if len(sorted_loads) >= 2 and (sorted_loads[0] - sorted_loads[1]) < 0.2:
                return True
        except (TypeError, ValueError, IndexError):
            continue
    return False


def _is_missing_variance_report(project_meta: Dict, reliability_results: List[Dict]) -> bool:
    """#7 不报累计方差解释率：reliability_results / project_meta 均无 cumulative_variance。"""
    has_in_results = any(r.get("cumulative_variance") is not None for r in reliability_results)
    has_in_meta = project_meta.get("cumulative_variance") is not None
    return not (has_in_results or has_in_meta)


def _is_factor_count_mismatch(project_meta: Dict, reliability_results: List[Dict]) -> bool:
    """#8 因子数与理论不符：提取因子数 ≠ 维度数。"""
    expected = project_meta.get("dimension_count")
    extracted = project_meta.get("extracted_factor_count")
    if expected is None or extracted is None:
        return False
    return int(extracted) != int(expected)


def _is_sample_too_small(project_meta: Dict, reliability_results: List[Dict]) -> bool:
    """#9 样本太少做 EFA：n < 100。"""
    n = project_meta.get("sample_size")
    if n is None:
        return False
    return int(n) < 100


def _is_fabricated_values(project_meta: Dict, reliability_results: List[Dict]) -> bool:
    """#10 编造 α/载荷值：α 或载荷不在合理区间（α>1 或 <0，载荷绝对值>1）。

    注：本工具生成模拟数据，正常流程不会触发；此规则用于拒绝异常输入/外部上传场景。
    """
    for r in reliability_results:
        alpha = r.get("alpha")
        if alpha is not None:
            try:
                if float(alpha) > 1.0 or float(alpha) < 0:
                    return True
            except (TypeError, ValueError):
                continue
    for ld in (project_meta.get("loadings") or []):
        try:
            if abs(float(ld)) > 1.0:
                return True
        except (TypeError, ValueError):
            continue
    return False


# ─────────────────────────────────────────────────────────────
# 翻车点规则表
# ─────────────────────────────────────────────────────────────
PITFALLS: List[Dict[str, Any]] = [
    {
        "code": "P01",
        "name": "反向题未反转",
        "detect": _is_reverse_unreversed,
        "metric": "reverse_items",
        "suggestion": "存在反向题但未做反向计分，会导致 α 偏低甚至负值。请在数据预处理阶段反转反向题（如 6 减去原值），再重算信度。",
    },
    {
        "code": "P02",
        "name": "混维度计算 α",
        "detect": _is_mixed_dim_alpha,
        "metric": "alpha_method",
        "suggestion": "不同维度题目混合计算 α 会稀释内部一致性。应按维度分别计算 Cronbach's α，再报告各维度与总量表 α。",
    },
    {
        "code": "P03",
        "name": "只报整体 α 不报分维度",
        "detect": _is_only_overall_alpha,
        "metric": "alpha_report",
        "suggestion": "仅报告总量表 α 无法反映各维度信度。请补报各维度 α 区间，便于读者判断量表结构稳定性。",
    },
    {
        "code": "P04",
        "name": "KMO<0.5 仍强行做 EFA",
        "detect": _is_kmo_below_threshold,
        "metric": "kmo",
        "suggestion": "KMO 低于 0.5 时数据不适合做因子分析，强行 EFA 会导致因子结构不稳定。建议先检查变量间相关性，或增加样本/调整题项后重测 KMO。",
    },
    {
        "code": "P05",
        "name": "载荷<0.4 不删题",
        "detect": _is_low_loading_not_dropped,
        "metric": "loading",
        "suggestion": "因子载荷低于 0.4 的题项对维度贡献不足，建议删除该题以提升整体信效度与结构清晰度。",
    },
    {
        "code": "P06",
        "name": "一题跨多因子",
        "detect": _is_cross_factor_loading,
        "metric": "loading",
        "suggestion": "该题在多个因子上载荷接近（差值 < 0.2），存在跨因子归属歧义。建议按较高载荷归类，或删除该题。",
    },
    {
        "code": "P07",
        "name": "未报累计方差解释率",
        "detect": _is_missing_variance_report,
        "metric": "cumulative_variance",
        "suggestion": "因子分析应报告累计方差解释率，以说明公因子对原变量的解释能力。请补充该指标。",
    },
    {
        "code": "P08",
        "name": "因子数与理论不符",
        "detect": _is_factor_count_mismatch,
        "metric": "factor_count",
        "suggestion": "提取的因子数与理论预设维度数不一致。请在论文中说明调整依据，或重新审视量表结构与题项归属。",
    },
    {
        "code": "P09",
        "name": "样本太少做 EFA",
        "detect": _is_sample_too_small,
        "metric": "sample_size",
        "suggestion": "样本量 < 100 时 EFA 结果稳定性不足。建议样本量提升至题目数的 5–10 倍，且不少于 100。",
    },
    {
        "code": "P10",
        "name": "编造 α/载荷值",
        "detect": _is_fabricated_values,
        "metric": "value_range",
        "suggestion": "检测到 α 或载荷值超出统计合理区间（α 应在 0–1，载荷绝对值应 ≤ 1）。禁止编造信效度数据，请使用真实计算结果。",
    },
]


def match_pitfalls(
    reliability_results: List[Dict],
    project_meta: Optional[Dict] = None,
) -> List[Dict[str, Any]]:
    """规则匹配入口：对翻车点 TOP10 逐条检测，返回命中问题列表。

    Args:
        reliability_results: 信效度分析结果（每维度一行）。
        project_meta: 项目元信息（sample_size / dimension_count /
            has_reverse_items / reverse_scored / loadings /
            loading_matrix / cumulative_variance / extracted_factor_count）。

    Returns:
        List[Dict]: 命中的翻车点，每条含 code/name/metric/suggestion。
    """
    meta = project_meta or {}
    hits: List[Dict[str, Any]] = []
    for rule in PITFALLS:
        try:
            if rule["detect"](meta, reliability_results):
                hits.append({
                    "code": rule["code"],
                    "dimension": "",  # 规则级问题，不绑定单一维度
                    "metric": rule["metric"],
                    "value": None,
                    "threshold": None,
                    "reason": f"命中翻车点 {rule['code']}：{rule['name']}",
                    "suggestion": rule["suggestion"],
                })
        except Exception:
            # 单条规则检测异常不应中断整体诊断
            continue
    return hits


# ─────────────────────────────────────────────────────────────
# 回归翻车点规则（P1，架构文档 9.1 / 9.4）
# 来源：统计学最佳实践（模板包回归翻车点 + 公开规范）
# 检测对象：diff_test.py 的 linear_regression 结果
# 注：VIF / Cook's distance / Durbin-Watson 等需扩展 diff_test 输出后补充
# ─────────────────────────────────────────────────────────────

# R² 社会科学可接受下限（模型解释力不足阈值）
R2_LOW_THRESHOLD = 0.3
# 样本量与自变量数比例下限（经验法则：n ≥ 10×k）
SAMPLE_PER_IV = 10


def _is_r2_too_low(test_result: Dict, sample_size: Optional[int]) -> bool:
    """R11 R² 过低：社会科学 R² < 0.3 视为模型解释力不足。"""
    r2 = test_result.get("effect_size")
    return r2 is not None and float(r2) < R2_LOW_THRESHOLD


def _is_sample_insufficient(test_result: Dict, sample_size: Optional[int]) -> bool:
    """R12 样本量不足：n < 10×自变量数，回归结果稳定性不足。"""
    if sample_size is None:
        return False
    coefs = test_result.get("coefficients") or {}
    iv_count = len(coefs) if coefs else 1
    return int(sample_size) < SAMPLE_PER_IV * iv_count


def _is_coef_direction_mismatch(test_result: Dict, sample_size: Optional[int]) -> bool:
    """R13 系数方向与假设不符：回归系数符号与假设方向不一致。

    test_result 携带 direction 字段（来自假设路径透传）。
    仅当方向明确（positive/negative）时检测。
    """
    direction = test_result.get("direction", "")
    coefs = test_result.get("coefficients") or {}
    if direction not in ("positive", "negative") or not coefs:
        return False
    expected_positive = direction == "positive"
    for coef in coefs.values():
        try:
            val = float(coef)
            if expected_positive and val < 0:
                return True
            if not expected_positive and val > 0:
                return True
        except (TypeError, ValueError):
            continue
    return False


def _is_overfitting_risk(test_result: Dict, sample_size: Optional[int]) -> bool:
    """R14 过拟合风险：自变量数 ≥ 样本量/10。"""
    if sample_size is None:
        return False
    coefs = test_result.get("coefficients") or {}
    iv_count = len(coefs) if coefs else 1
    return iv_count >= int(sample_size) / SAMPLE_PER_IV


REGRESSION_PITFALLS: List[Dict[str, Any]] = [
    {
        "code": "R11",
        "name": "R² 过低，模型解释力不足",
        "detect": _is_r2_too_low,
        "metric": "r_squared",
        "suggestion": (
            "R² 低于 0.3，模型对因变量的解释比例不足。建议增加关键自变量、"
            "检验非线性关系，或考虑分层回归引入调节变量。"
        ),
    },
    {
        "code": "R12",
        "name": "样本量不足做回归",
        "detect": _is_sample_insufficient,
        "metric": "sample_size",
        "suggestion": (
            "样本量未达到自变量数的 10 倍，回归系数估计不稳定。"
            "建议增大样本量至 10×自变量数以上，或减少自变量个数。"
        ),
    },
    {
        "code": "R13",
        "name": "回归系数方向与假设不符",
        "detect": _is_coef_direction_mismatch,
        "metric": "coef_direction",
        "suggestion": (
            "回归系数符号与假设方向相反，可能存在多重共线性或变量测量有误。"
            "建议检查 VIF（>10 提示共线性），审视变量编码方向，或重新评估理论假设。"
        ),
    },
    {
        "code": "R14",
        "name": "过拟合风险",
        "detect": _is_overfitting_risk,
        "metric": "iv_to_sample_ratio",
        "suggestion": (
            "自变量数接近样本量的 1/10，模型存在过拟合风险。"
            "建议减少自变量、增大样本量，或采用逐步回归筛选关键变量。"
        ),
    },
]


def match_regression_pitfalls(
    diff_tests: List[Dict],
    sample_size: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """回归翻车点规则匹配入口：对回归检验结果逐条检测。

    仅检测 method == "linear_regression" 的结果。

    Args:
        diff_tests: 差异检验结果列表（来自 diff_test.run_diff_tests）。
        sample_size: 样本量，用于样本量/过拟合检测。可选。

    Returns:
        List[Dict]: 命中的回归翻车点，结构同 match_pitfalls。
    """
    hits: List[Dict[str, Any]] = []
    for test in diff_tests:
        if test.get("method") != "linear_regression":
            continue
        predictor = test.get("predictor", "")
        outcome = test.get("outcome", "")
        path_label = f"{predictor}→{outcome}"
        for rule in REGRESSION_PITFALLS:
            try:
                if rule["detect"](test, sample_size):
                    # 提取指标值用于展示
                    metric = rule["metric"]
                    value: Optional[float] = None
                    threshold: Optional[float] = None
                    if metric == "r_squared":
                        value = test.get("effect_size")
                        threshold = R2_LOW_THRESHOLD
                    elif metric == "sample_size":
                        value = float(sample_size) if sample_size else None
                        coefs = test.get("coefficients") or {}
                        threshold = SAMPLE_PER_IV * (len(coefs) if coefs else 1)
                    elif metric == "iv_to_sample_ratio":
                        coefs = test.get("coefficients") or {}
                        iv_count = len(coefs) if coefs else 1
                        value = float(iv_count)
                        threshold = sample_size / SAMPLE_PER_IV if sample_size else None

                    hits.append({
                        "code": rule["code"],
                        "dimension": path_label,
                        "metric": metric,
                        "value": value,
                        "threshold": threshold,
                        "reason": f"命中回归翻车点 {rule['code']}：{rule['name']}（{path_label}）",
                        "suggestion": rule["suggestion"],
                    })
            except Exception:
                continue
    return hits
