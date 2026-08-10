"""统计判定常量与分档函数（唯一来源）。

职责：
- 集中定义 α / KMO / Bartlett / 因子载荷 / 累计方差 的分档表与通过阈值
- 提供 grade_xxx(value) -> (等级, 论文措辞) 分档函数
- 提供 is_passed(metric, value) -> bool 通过判定
- 提供 GRADE_TABLE_TEXT 供 diagnoser 等 prompt 注入，避免标准重复写死

设计依据：docs/后端架构设计文档.md 第 9.2 节
分档标准来源：数据分析模板包「信效度速查表」（基于公开统计学规范）
KMO 通过阈值已由 0.6 校准为 0.5，对齐学术通行标准。
"""
from __future__ import annotations

from typing import Callable, List, Tuple

# ─────────────────────────────────────────────────────────────
# 分档表：(分界值, 等级, 论文措辞)
# ─────────────────────────────────────────────────────────────

# α / KMO / 载荷 / 方差：数值越大越好，用降序分界
ALPHA_GRADES: List[Tuple[float, str, str]] = [
    (0.90, "优秀", "信度极好"),
    (0.80, "良好", "信度良好"),
    (0.70, "可接受", "信度可接受"),
    (0.00, "不达标", "信度不足，需删题或调整量表"),
]

KMO_GRADES: List[Tuple[float, str, str]] = [
    (0.90, "优秀", "非常适合做因子分析"),
    (0.80, "良好", "适合做因子分析"),
    (0.50, "可接受", "勉强适合做因子分析"),
    (0.00, "不达标", "不宜做因子分析"),
]

LOADING_GRADES: List[Tuple[float, str, str]] = [
    (0.70, "优秀", "载荷理想"),
    (0.60, "良好", "载荷良好"),
    (0.40, "可接受", "载荷可接受"),
    (0.00, "不达标", "载荷偏低，建议删除该题"),
]

VARIANCE_GRADES: List[Tuple[float, str, str]] = [
    (0.70, "优秀", "累计方差解释率理想"),
    (0.60, "良好", "累计方差解释率良好"),
    (0.50, "可接受", "累计方差解释率可接受"),
    (0.00, "不达标", "累计方差解释率偏低"),
]

# Bartlett p 值：数值越小越好，用升序分界（value < 分界值 即落入该档）
BARTLETT_GRADES: List[Tuple[float, str, str]] = [
    (0.001, "优秀", "极显著"),
    (0.01, "良好", "高度显著"),
    (0.05, "可接受", "显著"),
    (float("inf"), "不达标", "不显著"),
]

# ─────────────────────────────────────────────────────────────
# 通过阈值（通过线）
# ─────────────────────────────────────────────────────────────
THRESHOLDS: dict = {
    "alpha": 0.70,  # α >= 0.7 为合格
    "kmo": 0.50,  # KMO >= 0.5 为可接受（已由 0.6 校准为 0.5）
    "bartlett_p": 0.05,  # p < 0.05 为显著（Bartlett 球形检验）
    "p_value": 0.05,  # 假设检验显著性阈值（差异检验等通用 p 值）
    "loading": 0.40,  # 载荷 >= 0.4 为可接受
    "variance": 0.50,  # 累计方差 >= 50% 为可接受
}

# ─────────────────────────────────────────────────────────────
# 分档函数
# ─────────────────────────────────────────────────────────────


def _grade_descending(value: float, grades: List[Tuple[float, str, str]]) -> Tuple[str, str]:
    """数值越大越好的指标分档：返回首个 (value >= 分界值) 的 (等级, 措辞)。"""
    for threshold, grade, wording in grades:
        if value >= threshold:
            return grade, wording
    # 理论上不可达（最低分界为 0.00 / 已兜底）
    return grades[-1][1], grades[-1][2]


def _grade_ascending(value: float, grades: List[Tuple[float, str, str]]) -> Tuple[str, str]:
    """数值越小越好的指标分档（如 p 值）：返回首个 (value < 分界值) 的 (等级, 措辞)。"""
    for threshold, grade, wording in grades:
        if value < threshold:
            return grade, wording
    return grades[-1][1], grades[-1][2]


def grade_alpha(value: float) -> Tuple[str, str]:
    """Cronbach's α 分档。"""
    return _grade_descending(value, ALPHA_GRADES)


def grade_kmo(value: float) -> Tuple[str, str]:
    """KMO 分档。"""
    return _grade_descending(value, KMO_GRADES)


def grade_bartlett(p_value: float) -> Tuple[str, str]:
    """Bartlett 球形检验 p 值分档。"""
    return _grade_ascending(p_value, BARTLETT_GRADES)


def grade_loading(value: float) -> Tuple[str, str]:
    """因子载荷分档。"""
    return _grade_descending(value, LOADING_GRADES)


def grade_variance(value: float) -> Tuple[str, str]:
    """累计方差解释率分档（value 传小数，如 0.62 表示 62%）。"""
    return _grade_descending(value, VARIANCE_GRADES)


_GRADE_FUNCS: dict = {
    "alpha": grade_alpha,
    "kmo": grade_kmo,
    "bartlett_p": grade_bartlett,
    "loading": grade_loading,
    "variance": grade_variance,
}


def grade(metric: str, value: float) -> Tuple[str, str]:
    """通用分档入口。

    Args:
        metric: 指标名（alpha/kmo/bartlett_p/loading/variance）。
        value: 指标值。

    Returns:
        (等级, 论文措辞)。
    """
    func = _GRADE_FUNCS.get(metric)
    if func is None:
        raise ValueError(f"未知指标: {metric}")
    return func(value)


def is_passed(metric: str, value: float) -> bool:
    """判定单指标是否通过合格线。

    Args:
        metric: 指标名（alpha/kmo/bartlett_p/loading/variance）。
        value: 指标值。

    Returns:
        True 表示达标。
    """
    threshold = THRESHOLDS.get(metric)
    if threshold is None:
        raise ValueError(f"未知指标: {metric}")
    if metric == "bartlett_p":
        # p 值越小越显著
        return value < threshold
    return value >= threshold


# ─────────────────────────────────────────────────────────────
# 分档表文本（供 diagnoser 等 prompt 注入，避免标准重复写死）
# ─────────────────────────────────────────────────────────────
GRADE_TABLE_TEXT = """【信效度分档标准】
| 指标 | 优秀 | 良好 | 可接受 | 不达标 |
| Cronbach's α | ≥0.90 | 0.80–0.89 | 0.70–0.79 | <0.70 |
| KMO | ≥0.90 | 0.80–0.89 | 0.50–0.79 | <0.50 |
| Bartlett p | <0.001 | <0.01 | <0.05 | ≥0.05 |
| 因子载荷 | ≥0.70 | 0.60–0.69 | 0.40–0.59 | <0.40 |
| 累计方差解释率 | ≥70% | 60–69% | 50–59% | <50% |

【合格线】α≥0.7 / KMO≥0.5 / Bartlett p<0.05 / 载荷≥0.4 / 累计方差≥50%"""


def build_grade_label(metric: str, value: float) -> str:
    """生成「值 (等级 / 措辞)」展示文本，供报告/前端展示。"""
    grade_label, wording = grade(metric, value)
    if metric == "variance":
        # 方差以百分比展示
        return f"{value*100:.1f}% ({grade_label} / {wording})"
    if metric == "bartlett_p":
        return f"{value} ({grade_label} / {wording})"
    return f"{value} ({grade_label} / {wording})"


# ─────────────────────────────────────────────────────────────
# 假设强度 → 相关系数映射（唯一来源）
# 设计依据：docs/后端架构设计文档.md 第 9.5 节
# ─────────────────────────────────────────────────────────────

# 强度档位 → 目标相关系数（生成用补偿值）
# 李克特量表整数化（连续→1-5）会造成相关性衰减，故生成时采用补偿值，
# 使数据呈现的相关性在衰减后仍接近 Cohen 名义值（r 0.1/0.3/0.5）。
STRENGTH_TO_R: dict = {
    "weak": 0.2,
    "medium": 0.4,
    "strong": 0.6,
}

# 强度档位 → 名义相关系数（对外展示，对齐 Cohen 国际标准）
# 用于报告/前端展示「假设强度对应的相关性水平」，不参与数据生成。
STRENGTH_NOMINAL: dict = {
    "weak": 0.1,
    "medium": 0.3,
    "strong": 0.5,
}

# 李克特离散化衰减补偿系数（生成值 / 名义值 的经验倍率，仅作记录与对齐说明用）
LIKERT_DISCRETIZATION_COMPENSATION: float = 2.0


# ─────────────────────────────────────────────────────────────
# 效应量分档（Cohen d / r，唯一来源）
# ─────────────────────────────────────────────────────────────

# 效应量分档表：(分界值, 等级) —— 数值越大越好，用降序分界
EFFECT_SIZE_GRADES: List[Tuple[float, str]] = [
    (0.5, "大"),
    (0.3, "中"),
    (0.1, "小"),
    (0.0, "可忽略"),
]


def grade_effect_size(value: float) -> str:
    """效应量分档，返回等级文本（大/中/小/可忽略）。"""
    for threshold, grade_label in EFFECT_SIZE_GRADES:
        if value >= threshold:
            return grade_label
    return EFFECT_SIZE_GRADES[-1][1]


# ─────────────────────────────────────────────────────────────
# 回归诊断阈值（唯一来源）
# 来源：统计学最佳实践（模板包回归翻车点 + 公开规范）
# ─────────────────────────────────────────────────────────────

# R² 社会科学可接受下限（模型解释力不足阈值）
R2_LOW_THRESHOLD: float = 0.3

# 样本量与自变量数比例下限（经验法则：n ≥ 10×k）
SAMPLE_PER_IV: int = 10

# ─────────────────────────────────────────────────────────────
# 样本代表性诊断阈值（唯一来源，F-RPT-007）
# 来源：docs/b-功能清单.md F-RPT-007 规则（N<200 / 男女比<3:7 / 集中度>80%）
# ─────────────────────────────────────────────────────────────

# 样本量下限：中等效应量分析（r≈0.3）建议样本量（G*Power 经验值）
REPRESENTATIVE_MIN_SAMPLE: int = 200

# 性别分布失衡阈值：任意性别占比 < 3:7 下限视为结构失衡
GENDER_MIN_RATIO: float = 0.30

# 单项集中度阈值：人口学变量中单一类别占比超过该值视为结构集中
CONCENTRATION_RATIO: float = 0.80
