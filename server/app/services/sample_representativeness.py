"""样本代表性诊断引擎（F-RPT-007）。

职责：
- 基于真实数据集 + 已识别的人口学题目，输出样本结构体检报告
- 规则匹配常见问题（N<200、男女比<3:7、年龄集中>80%），确定性、必出
- LLM 补充「说人话」总结与建议；LLM 失败时降级为仅规则结果
- 只做诊断与改进建议，不提供样本购买/投放/收集服务（差异化边界）

设计依据：docs/b-功能清单.md F-RPT-007（v2.0）
阈值来源：app/core/statistics_constants.py（唯一来源，禁止重复写死）
"""
from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

import pandas as pd

from app.core.statistics_constants import (
    REPRESENTATIVE_MIN_SAMPLE,
    GENDER_MIN_RATIO,
    CONCENTRATION_RATIO,
)
from app.services.llm.client import chat_flash
from app.services.llm.utils import (
    build_prompt_injection_guard,
    parse_llm_json_response,
    wrap_user_input,
)

logger = logging.getLogger(__name__)

# 人口学变量关键词 → 展示名（用于识别 性别/年龄/收入/专业 等变量）
_DEMO_KEYWORDS: Dict[str, str] = {
    "性别": "性别",
    "年龄": "年龄",
    "收入": "收入",
    "专业": "专业",
    "学历": "学历",
    "职业": "职业",
    "年级": "年级",
    "地域": "地域",
    "城市": "城市",
}


@dataclass
class DemoDistribution:
    """单个人口学变量的类别分布。"""

    index: int
    text: str
    label: str  # 变量类型标签（性别/年龄/收入/.../其他）
    counts: Dict[str, int] = field(default_factory=dict)  # 类别 → 数量
    total: int = 0
    top_category: str = ""
    top_share: float = 0.0  # 最大类别占比（0~1）


@dataclass
class CheckItem:
    """单项检查结果。"""

    key: str
    title: str
    status: str  # "pass" | "warn" | "fail"
    score: float  # 0~100
    message: str
    suggestion: str = ""


@dataclass
class SampleRepReport:
    """样本代表性体检报告。"""

    supported: bool = True  # 仅真实数据项目支持
    message: str = ""
    sample_size: int = 0
    has_demographic: bool = False
    overall_score: float = 0.0  # 0~100
    grade: str = "C"
    summary: str = ""
    distributions: List[DemoDistribution] = field(default_factory=list)
    items: List[CheckItem] = field(default_factory=list)
    ai_conclusion: str = ""  # LLM 说人话总结（失败时为空，前端提示仅规则结果）

    def to_dict(self) -> dict:
        return {
            "supported": self.supported,
            "message": self.message,
            "sample_size": self.sample_size,
            "has_demographic": self.has_demographic,
            "overall_score": round(self.overall_score, 1),
            "grade": self.grade,
            "summary": self.summary,
            "distributions": [
                {
                    "index": d.index,
                    "text": d.text,
                    "label": d.label,
                    "counts": d.counts,
                    "total": d.total,
                    "top_category": d.top_category,
                    "top_share": round(d.top_share, 3),
                }
                for d in self.distributions
            ],
            "items": [
                {
                    "key": it.key,
                    "title": it.title,
                    "status": it.status,
                    "score": round(it.score, 1),
                    "message": it.message,
                    "suggestion": it.suggestion,
                }
                for it in self.items
            ],
            "ai_conclusion": self.ai_conclusion,
        }


def _detect_label(text: str) -> str:
    """从题干文本识别人口学变量类型。"""
    for kw, label in _DEMO_KEYWORDS.items():
        if kw in text:
            return label
    return "其他"


class SampleRepresentativenessEngine:
    """样本代表性诊断引擎（纯规则部分）。"""

    def __init__(
        self,
        questions: Iterable,
        df: Optional[pd.DataFrame],
        sample_size: Optional[int],
    ):
        """初始化。

        Args:
            questions: 已识别的题目（Question 模型，含 question_type/text/index）。
            df: 真实数据集 DataFrame（列名为 q{index}）。
            sample_size: 样本量。
        """
        self.demo_questions = [
            q for q in questions if not getattr(q, "deleted_at", None)
            and q.question_type == "demographic"
        ]
        self.df = df
        self.sample_size = sample_size or (len(df) if df is not None else 0)

    # -- 公共入口 --
    def run(self) -> SampleRepReport:
        report = SampleRepReport(
            sample_size=self.sample_size,
            has_demographic=bool(self.demo_questions),
        )
        if not self.demo_questions:
            report.message = "未检测到人口学变量，请先在题目体检中标记人口学题（性别/年龄等）。"
            report.overall_score = 0.0
            report.grade = "C"
            report.summary = report.message
            return report

        distributions = self._extract_distributions()
        report.distributions = distributions

        items: List[CheckItem] = [
            self._check_sample_size(),
            self._check_gender_balance(distributions),
            self._check_concentration(distributions),
        ]
        report.items = items

        report.overall_score = self._weighted_score(items)
        report.grade = self._score_to_grade(report.overall_score)
        report.summary = self._build_summary(report.overall_score, report.grade)
        return report

    # -- 分布提取 --

    def _extract_distributions(self) -> List[DemoDistribution]:
        distributions: List[DemoDistribution] = []
        if self.df is None:
            return distributions
        for q in self.demo_questions:
            col = f"q{q.index}"
            if col not in self.df.columns:
                continue
            series = self.df[col].dropna()
            # 类别值统一转为字符串，避免 int/str 混同
            counts = Counter(str(v) for v in series)
            total = sum(counts.values())
            if not counts:
                continue
            top_category = max(counts, key=counts.get)
            distributions.append(
                DemoDistribution(
                    index=q.index,
                    text=q.text,
                    label=_detect_label(q.text),
                    counts=dict(counts.most_common()),
                    total=total,
                    top_category=top_category,
                    top_share=counts[top_category] / total,
                )
            )
        return distributions

    # -- 各检查项 --

    def _check_sample_size(self) -> CheckItem:
        n = self.sample_size
        if n == 0:
            return CheckItem(
                "sample_size", "样本量", "fail", 0,
                "未获取到样本量数据，无法评估。",
            )
        if n < REPRESENTATIVE_MIN_SAMPLE:
            return CheckItem(
                "sample_size", "样本量", "fail", 40,
                f"当前样本 N={n}，低于代表性建议下限 {REPRESENTATIVE_MIN_SAMPLE}。",
                f"做中等效应量分析（r≈0.3）至少需要 N={REPRESENTATIVE_MIN_SAMPLE}，建议补收样本（本工具不提供样本收集/投放服务）。",
            )
        return CheckItem(
            "sample_size", "样本量", "pass", 100,
            f"当前样本 N={n}，满足中等效应量分析建议量。",
        )

    def _check_gender_balance(self, distributions: List[DemoDistribution]) -> CheckItem:
        """性别分布失衡：两类别变量中任一类别占比 < 3:7 视为失衡。"""
        for d in distributions:
            if d.label != "性别" or len(d.counts) != 2:
                continue
            shares = sorted(c / d.total for c in d.counts.values())
            min_share = shares[0]
            max_share = shares[1]
            if min_share < GENDER_MIN_RATIO:
                # 将数值类别转回展示文本（男/女 或 1/2）
                low_cat = min(d.counts, key=lambda k: d.counts[k])
                high_cat = max(d.counts, key=lambda k: d.counts[k])
                return CheckItem(
                    "gender_balance", "性别分布", "fail", 50,
                    f"性别分布失衡：{high_cat}:{low_cat} ≈ {max_share:.0%}:{min_share:.0%}，结构失衡。",
                    f"建议补充 {low_cat} 样本至不低于 3:7（即 {GENDER_MIN_RATIO:.0%}），提高代表性（本工具不提供样本收集/投放服务）。",
                )
            return CheckItem(
                "gender_balance", "性别分布", "pass", 100,
                f"性别分布较均衡：{max_share:.0%}:{min_share:.0%}，满足 3:7 底线。",
            )
        # 无性别题或非两分类：不评估，不扣分
        return CheckItem(
            "gender_balance", "性别分布", "pass", 100,
            "未检测到可评估的两分类性别变量，本项不参与评分。",
        )

    def _check_concentration(self, distributions: List[DemoDistribution]) -> CheckItem:
        """结构集中：任一人口学变量单一类别占比 > 80% 视为结构集中。"""
        concentrated: List[str] = []
        for d in distributions:
            if d.top_share > CONCENTRATION_RATIO:
                concentrated.append(f"{d.label}（{d.top_category}占{d.top_share:.0%}）")
        if concentrated:
            return CheckItem(
                "concentration", "结构集中度", "warn", 60,
                f"样本结构集中：{'、'.join(concentrated)}。",
                "样本无法代表目标总体该维度的多样性，建议在报告局限性中说明，并定向补收对应群体（本工具不提供样本收集/投放服务）。",
            )
        return CheckItem(
            "concentration", "结构集中度", "pass", 100,
            "人口学变量各类别分布较分散，无过度集中。",
        )

    # -- 汇总 --

    @staticmethod
    def _weighted_score(items: List[CheckItem]) -> float:
        if not items:
            return 0.0
        weight_map = {"pass": 1.0, "warn": 0.7, "fail": 0.3}
        total_w = sum(weight_map.get(it.status, 0.5) for it in items)
        return (total_w / len(items)) * 100

    @staticmethod
    def _score_to_grade(score: float) -> str:
        if score >= 85:
            return "A"
        if score >= 70:
            return "B"
        if score >= 50:
            return "C"
        return "D"

    @staticmethod
    def _build_summary(score: float, grade: str) -> str:
        if grade == "A":
            return f"样本代表性良好（{score:.0f} 分），结构接近目标总体。"
        if grade == "B":
            return f"样本代表性尚可（{score:.0f} 分），存在少量可优化项。"
        if grade == "C":
            return f"样本代表性一般（{score:.0f} 分），建议按检查项补收对应群体后再下结论。"
        return f"样本代表性不足（{score:.0f} 分），结论推广需谨慎。"


# ─────────────────────────────────────────────────────────────
# LLM 补充（说人话诊断，失败降级为仅规则结果）
# ─────────────────────────────────────────────────────────────

_LLM_SYSTEM = "你是严谨的问卷研究方法论专家，擅长用大白话讲清样本结构问题。回答保持简洁、可执行。"


def _build_llm_prompt(report: SampleRepReport) -> str:
    """构建「说人话」诊断提示词。

    N1: 分布数据源自用户项目数据（不可信），使用 <user_input> 边界包裹并附加注入防御。
    """
    import json

    dist_text = json.dumps(
        [
            {
                "variable": d.label,
                "text": d.text,
                "counts": d.counts,
                "total": d.total,
                "top_share": round(d.top_share, 3),
            }
            for d in report.distributions
        ],
        ensure_ascii=False,
        indent=2,
    )
    items_text = json.dumps(
        [
            {
                "key": it.key,
                "title": it.title,
                "status": it.status,
                "message": it.message,
            }
            for it in report.items
        ],
        ensure_ascii=False,
        indent=2,
    )

    prompt = f"""请基于以下真实问卷样本结构，用一句话给用户讲清楚「样本代表性怎么看」，再给 1~2 条最要紧的可执行建议。

{build_prompt_injection_guard()}

样本量：N={report.sample_size}

人口学变量分布：
{wrap_user_input(dist_text, label="demographic_distributions")}

规则引擎检查结果（仅供参考）：
{wrap_user_input(items_text, label="rule_items")}

任务要求：
1. conclusion：用一句话总结样本代表性现状（如「样本量偏小且以女性为主，结论推广受限」）
2. suggestions：给 1~2 条最要紧的可执行建议（只说补收/分层/报告局限性这类研究操作，不提及任何样本购买或投放服务）
3. 只返回 JSON，不要多余文字

请以 JSON 格式返回：
{{
  "conclusion": "一句话总结",
  "suggestions": ["建议1", "建议2"]
}}"""
    return prompt


def llm_enrich(report: SampleRepReport) -> str:
    """生成「说人话」结论；失败时记录日志并返回空串（前端降级为仅规则结果）。"""
    if not report.has_demographic:
        return ""

    try:
        response = chat_flash(_build_llm_prompt(report), system=_LLM_SYSTEM)
        data = parse_llm_json_response(response)
        conclusion = str(data.get("conclusion", "")).strip()
        suggestions = data.get("suggestions") or []
        parts = [conclusion] if conclusion else []
        for s in suggestions:
            s = str(s).strip()
            if s:
                parts.append(f"建议：{s}")
        return "；".join(parts)
    except Exception as e:
        logger.warning(
            "样本代表性 LLM 补充失败，降级为仅规则结果 | error=%s", e, exc_info=True
        )
        return ""
