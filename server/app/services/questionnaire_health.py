"""问卷质量体检引擎（纯规则，不依赖 LLM）。

基于已识别的题目结构（Question 表）做质量诊断，输出检查项、得分与优化建议。
设计目标：快速、免费、可量化，作为 inspector.py（LLM 识别）的下游补充。
"""
from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass, field
from typing import Iterable

from app.models.questionnaire import Question


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

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
class HealthReport:
    """问卷体检报告。"""
    total_questions: int
    overall_score: float  # 0~100，加权综合分
    grade: str  # A / B / C / D
    items: list[CheckItem] = field(default_factory=list)
    summary: str = ""

    def to_dict(self) -> dict:
        return {
            "total_questions": self.total_questions,
            "overall_score": round(self.overall_score, 1),
            "grade": self.grade,
            "summary": self.summary,
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
        }


# ---------------------------------------------------------------------------
# 阈值常量（可后续抽到配置）
# ---------------------------------------------------------------------------

_LIKERT_TYPES = {"likert5", "likert7"}
_MIN_TOTAL_LIKERT = 15          # 量表题最少题量（信度底线）
_IDEAL_TOTAL_LIKERT = (20, 50)  # 理想题量区间
_MIN_PER_DIM = 3                # 每个维度最少题数
_IDEAL_PER_DIM = (3, 8)         # 每维度理想题数区间
_REVERSE_RATIO = (0.10, 0.30)   # 反向题理想占比区间
_MIN_DEMO = 2                   # 最少人口学题数（性别/年龄等）
_MIN_TEXT_LEN = 8               # 题干最短字符数


# ---------------------------------------------------------------------------
# 引擎
# ---------------------------------------------------------------------------

class QuestionnaireHealthEngine:
    """问卷质量体检引擎。"""

    def __init__(self, questions: Iterable[Question]):
        self.questions: list[Question] = [q for q in questions if not q.deleted_at]

    # -- 公共入口 --
    def run(self) -> HealthReport:
        items: list[CheckItem] = []
        for fn in (
            self._check_total_count,
            self._check_dimension_balance,
            self._check_reverse_ratio,
            self._check_demographic_coverage,
            self._check_scale_consistency,
            self._check_low_confidence,
            self._check_text_quality,
        ):
            items.append(fn())

        overall = self._weighted_score(items)
        grade = self._score_to_grade(overall)
        total = len(self.questions)
        summary = self._build_summary(total, overall, grade)

        return HealthReport(
            total_questions=total,
            overall_score=overall,
            grade=grade,
            items=items,
            summary=summary,
        )

    # -- 各检查项 --

    def _check_total_count(self) -> CheckItem:
        likert = [q for q in self.questions if q.question_type in _LIKERT_TYPES]
        n = len(likert)
        lo, hi = _IDEAL_TOTAL_LIKERT

        if n == 0:
            return CheckItem("total_count", "量表题题量", "fail", 0,
                             "未识别到量表题（likert5/likert7）。",
                             "请先通过题目识别或问卷星导入生成量表题。")
        if n < _MIN_TOTAL_LIKERT:
            return CheckItem("total_count", "量表题题量", "fail", 30,
                             f"量表题仅 {n} 题，低于信度底线 {_MIN_TOTAL_LIKERT} 题。",
                             f"建议补充至至少 {_MIN_TOTAL_LIKERT} 题，理想区间 {lo}-{hi} 题。")
        if n < lo:
            return CheckItem("total_count", "量表题题量", "warn", 65,
                             f"量表题 {n} 题，略偏少。",
                             f"建议补充至 {lo}-{hi} 题以提升信度。")
        if n > hi:
            return CheckItem("total_count", "量表题题量", "warn", 80,
                             f"量表题 {n} 题，偏多可能导致作答疲劳。",
                             f"建议精简至 {lo}-{hi} 题。")
        return CheckItem("total_count", "量表题题量", "pass", 100,
                         f"量表题 {n} 题，处于理想区间。")

    def _check_dimension_balance(self) -> CheckItem:
        likert = [q for q in self.questions if q.question_type in _LIKERT_TYPES]
        dim_counter: Counter[str] = Counter(q.dimension for q in likert)
        if not dim_counter:
            return CheckItem("dim_balance", "维度均衡性", "fail", 0,
                             "无量表题，无法评估维度分布。")

        counts = list(dim_counter.values())
        under_min = [d for d, c in dim_counter.items() if c < _MIN_PER_DIM]
        mean = sum(counts) / len(counts)
        # 变异系数 CV
        variance = sum((c - mean) ** 2 for c in counts) / len(counts)
        cv = math.sqrt(variance) / mean if mean else 0

        if under_min:
            return CheckItem("dim_balance", "维度均衡性", "fail", 40,
                             f"{len(under_min)} 个维度题数不足 {_MIN_PER_DIM} 题：{', '.join(under_min)}。",
                             f"每个维度建议至少 {_MIN_PER_DIM} 题。")
        if cv > 0.6:
            return CheckItem("dim_balance", "维度均衡性", "warn", 70,
                             f"各维度题数差异较大（CV={cv:.2f}）。",
                             "建议各维度题数尽量接近。")
        return CheckItem("dim_balance", "维度均衡性", "pass", 100,
                         f"共 {len(dim_counter)} 个维度，分布较均衡（CV={cv:.2f}）。")

    def _check_reverse_ratio(self) -> CheckItem:
        likert = [q for q in self.questions if q.question_type in _LIKERT_TYPES]
        if not likert:
            return CheckItem("reverse_ratio", "反向题比例", "warn", 50,
                             "无量表题，无法评估反向题。")
        reverse_n = sum(1 for q in likert if q.is_reverse)
        ratio = reverse_n / len(likert)
        lo, hi = _REVERSE_RATIO

        if ratio == 0:
            return CheckItem("reverse_ratio", "反向题比例", "warn", 60,
                             "未设置反向题，难以识别随意作答。",
                             f"建议设置 {int(lo*100)}%-{int(hi*100)}% 的反向题。")
        if ratio < lo:
            return CheckItem("reverse_ratio", "反向题比例", "warn", 75,
                             f"反向题占比 {ratio:.0%}，偏少。",
                             f"建议提升至 {int(lo*100)}%-{int(hi*100)}%。")
        if ratio > hi:
            return CheckItem("reverse_ratio", "反向题比例", "warn", 75,
                             f"反向题占比 {ratio:.0%}，偏多增加计分复杂度。",
                             f"建议控制在 {int(lo*100)}%-{int(hi*100)}%。")
        return CheckItem("reverse_ratio", "反向题比例", "pass", 100,
                         f"反向题占比 {ratio:.0%}，处于理想区间。")

    def _check_demographic_coverage(self) -> CheckItem:
        demo = [q for q in self.questions if q.question_type == "demographic"]
        n = len(demo)
        if n == 0:
            return CheckItem("demo_coverage", "人口学覆盖", "warn", 50,
                             "未识别到人口学题目。",
                             "建议补充性别、年龄等基本人口学变量。")
        if n < _MIN_DEMO:
            return CheckItem("demo_coverage", "人口学覆盖", "warn", 70,
                             f"仅 {n} 道人口学题，覆盖不足。",
                             f"建议至少 {_MIN_DEMO} 道（如性别、年龄）。")
        return CheckItem("demo_coverage", "人口学覆盖", "pass", 100,
                         f"共 {n} 道人口学题，覆盖充分。")

    def _check_scale_consistency(self) -> CheckItem:
        """同一维度内 likert5/likert7 不应混用。"""
        dim_types: dict[str, set[str]] = {}
        for q in self.questions:
            if q.question_type in _LIKERT_TYPES:
                dim_types.setdefault(q.dimension, set()).add(q.question_type)
        mixed = [d for d, s in dim_types.items() if len(s) > 1]
        if mixed:
            return CheckItem("scale_consistency", "量表类型一致性", "fail", 50,
                             f"{len(mixed)} 个维度混用了 5 点/7 点量表：{', '.join(mixed)}。",
                             "同一维度内应统一量表刻度。")
        return CheckItem("scale_consistency", "量表类型一致性", "pass", 100,
                         "各维度内量表刻度一致。")

    def _check_low_confidence(self) -> CheckItem:
        low = [q for q in self.questions if q.confidence == "low"]
        if not self.questions:
            return CheckItem("low_confidence", "识别置信度", "fail", 0,
                             "无题目数据。")
        ratio = len(low) / len(self.questions)
        if ratio > 0.3:
            return CheckItem("low_confidence", "识别置信度", "warn", 60,
                             f"{len(low)} 道题（{ratio:.0%}）识别置信度偏低。",
                             "建议人工复核低置信度题目的维度/反向标记。")
        if low:
            return CheckItem("low_confidence", "识别置信度", "pass", 85,
                             f"{len(low)} 道题置信度偏低，占比可控。")
        return CheckItem("low_confidence", "识别置信度", "pass", 100,
                         "所有题目识别置信度均较高。")

    def _check_text_quality(self) -> CheckItem:
        texts = [q.text.strip() for q in self.questions if q.text]
        too_short = [t for t in texts if len(t) < _MIN_TEXT_LEN]
        # 重复检测（完全相同）
        dup_counter = Counter(texts)
        duplicates = {t: c for t, c in dup_counter.items() if c > 1}
        dup_n = sum(c - 1 for c in duplicates.values())

        if not self.questions:
            return CheckItem("text_quality", "题干文本质量", "fail", 0,
                             "无题目数据。")
        issues: list[str] = []
        if too_short:
            issues.append(f"{len(too_short)} 题题干过短（<{_MIN_TEXT_LEN} 字）")
        if duplicates:
            issues.append(f"{dup_n} 题疑似重复")
        if issues:
            return CheckItem("text_quality", "题干文本质量", "warn", 70,
                             "；".join(issues) + "。",
                             "建议补充题干描述、删除重复题。")
        return CheckItem("text_quality", "题干文本质量", "pass", 100,
                         "题干文本质量良好。")

    # -- 汇总 --

    @staticmethod
    def _weighted_score(items: list[CheckItem]) -> float:
        """加权综合分：fail 权重 0.3，warn 权重 0.7，pass 权重 1.0。"""
        if not items:
            return 0.0
        weight_map = {"pass": 1.0, "warn": 0.7, "fail": 0.3}
        total_w = sum(weight_map.get(it.status, 0.5) for it in items)
        # 归一化到 0-100
        max_possible = len(items) * 1.0
        return (total_w / max_possible) * 100 if max_possible else 0.0

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
    def _build_summary(total: int, score: float, grade: str) -> str:
        if total == 0:
            return "暂无题目，请先导入或识别问卷。"
        if grade == "A":
            return f"问卷质量优秀（{score:.0f} 分），可进入模拟预演。"
        if grade == "B":
            return f"问卷质量良好（{score:.0f} 分），有少量可优化项。"
        if grade == "C":
            return f"问卷质量一般（{score:.0f} 分），建议按检查项优化后再预演。"
        return f"问卷质量较差（{score:.0f} 分），存在关键问题，强烈建议优化。"
