"""诊断服务（R4）。

职责：
- 规则匹配（确定性，必出）：调用 diagnosis_rules 翻车点 TOP10 + 回归翻车点检测
- LLM 补充（自然语言原因）：DeepSeek R1 针对未达标指标生成 reason/suggestion
- 合并去重：规则优先，LLM 补充未覆盖的指标级问题

设计依据：docs/后端架构设计文档.md 第 9.3 节
阈值与分档标准来源：app/core/statistics_constants.py（唯一来源，禁止重复写死）
"""
import json
import logging
from typing import Any, Dict, List, Optional

from app.core.statistics_constants import GRADE_TABLE_TEXT, THRESHOLDS, is_passed
from app.services.diagnosis_rules import match_pitfalls, match_regression_pitfalls
from app.services.llm.client import chat_r1
from app.services.llm.utils import (
    build_prompt_injection_guard,
    parse_llm_json_response,
    wrap_user_input,
)

logger = logging.getLogger(__name__)


def _build_prompt(reliability_results: List[Dict], rule_hits: List[Dict]) -> str:
    """构建 LLM 诊断提示词。

    标准文本通过 GRADE_TABLE_TEXT 注入，避免重复写死；
    规则已命中的翻车点传给 LLM 作为上下文，请其补充自然语言原因而非重复罗列。

    N1: 信效度结果与规则命中均源自用户项目数据（不可信），
    使用 <user_input> 边界标记包裹，并附加 prompt injection 防御指令。
    """
    results_text = json.dumps(reliability_results, ensure_ascii=False, indent=2)
    rules_text = (
        json.dumps(rule_hits, ensure_ascii=False, indent=2)
        if rule_hits
        else "（无）"
    )
    wrapped_results = wrap_user_input(results_text, label="reliability_results")
    wrapped_rules = wrap_user_input(rules_text, label="rule_hits")

    prompt = f"""你是一个心理学测量专家。请根据以下信效度分析结果，针对未达标指标诊断问题并给出修改建议。

{build_prompt_injection_guard()}

信效度结果：
{wrapped_results}

规则引擎已命中的翻车点（仅供参考，请勿原样重复，可补充原因语境）：
{wrapped_rules}

{GRADE_TABLE_TEXT}

任务要求：
1. 只列出未达合格线的指标（α<{THRESHOLDS['alpha']} / KMO<{THRESHOLDS['kmo']} / Bartlett p≥{THRESHOLDS['bartlett_p']}）
2. reason 要具体说明可能的原因（如题目数量少、维度内部一致性差、样本量不足等）
3. suggestion 要给出可操作的修改建议
4. 如果所有指标都达标，passed 为 true，issues 为空数组
5. 规则引擎已覆盖的翻车点不要重复输出

请以 JSON 格式返回，结构如下：
{{
  "passed": true/false,
  "issues": [
    {{
      "dimension": "维度名称",
      "metric": "指标名称（alpha/kmo/bartlett_p）",
      "value": 0.123,
      "threshold": {THRESHOLDS['alpha']},
      "reason": "问题原因分析",
      "suggestion": "修改建议"
    }}
  ]
}}
"""
    return prompt


def _parse_llm_response(response: str) -> Dict[str, Any]:
    """解析 LLM 返回的 JSON。

    N6: 使用 llm.utils 中的统一解析函数，避免重复实现。
    """
    data = parse_llm_json_response(response)

    # 规范化字段
    data.setdefault("passed", False)
    data.setdefault("issues", [])
    return data


def _merge_issues(
    rule_hits: List[Dict], llm_issues: List[Dict]
) -> List[Dict[str, Any]]:
    """合并规则与 LLM 的问题列表，按 (dimension, metric) 去重，规则优先。"""
    merged: List[Dict[str, Any]] = []
    seen_keys = set()

    # 1. 规则命中优先
    for issue in rule_hits:
        key = (str(issue.get("dimension", "")), str(issue.get("metric", "")))
        if key not in seen_keys:
            seen_keys.add(key)
            merged.append(issue)

    # 2. LLM 补充未覆盖的指标级问题
    for issue in llm_issues:
        key = (str(issue.get("dimension", "")), str(issue.get("metric", "")))
        if key not in seen_keys:
            seen_keys.add(key)
            # 规范化 value/threshold 字段类型
            value = issue.get("value")
            threshold = issue.get("threshold")
            try:
                value = float(value) if value is not None else None
            except (TypeError, ValueError):
                value = None
            try:
                threshold = float(threshold) if threshold is not None else None
            except (TypeError, ValueError):
                threshold = None
            merged.append({
                "dimension": issue.get("dimension", ""),
                "metric": issue.get("metric", ""),
                "value": value,
                "threshold": threshold,
                "reason": issue.get("reason", ""),
                "suggestion": issue.get("suggestion", ""),
            })

    return merged


def diagnose(
    reliability_results: List[Dict],
    project_meta: Optional[Dict] = None,
    diff_tests: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """诊断入口。

    流程：规则匹配（确定性）→ LLM 补充（自然语言原因）→ 合并去重。

    Args:
        reliability_results: 信效度分析结果列表（每维度一行）。
        project_meta: 项目元信息（sample_size / dimension_count /
            has_reverse_items / reverse_scored / loadings /
            loading_matrix / cumulative_variance / extracted_factor_count）。
            可选，缺失时相应规则自动跳过。
        diff_tests: 差异检验结果列表（来自 diff_test.run_diff_tests）。
            提供时检测回归翻车点（R11~R14）。可选。

    Returns:
        Dict: 诊断结果（passed + issues）。
    """
    if not reliability_results and not diff_tests:
        return {"passed": False, "issues": []}

    meta = project_meta or {}
    sample_size = meta.get("sample_size")

    # 1. 规则匹配（确定性，必出）
    rule_hits = match_pitfalls(reliability_results, meta) if reliability_results else []

    # 1b. 回归翻车点匹配（基于差异检验的回归结果）
    if diff_tests:
        rule_hits = rule_hits + match_regression_pitfalls(diff_tests, sample_size)

    # 2. LLM 补充（自然语言原因，仅信效度部分）
    llm_issues: List[Dict] = []
    if reliability_results:
        prompt = _build_prompt(reliability_results, rule_hits)
        try:
            response = chat_r1(prompt)
            llm_result = _parse_llm_response(response)
            llm_issues = llm_result.get("issues", [])
        except Exception as e:
            # N7: LLM 异常不应阻断规则结果输出，但必须记录日志便于排查
            logger.warning(
                "LLM 诊断补充失败，已降级为仅规则结果 | error=%s | reliability_count=%d",
                e,
                len(reliability_results),
                exc_info=True,
            )

    # 3. 合并去重（规则优先）
    merged_issues = _merge_issues(rule_hits, llm_issues)

    # 4. 判定 passed：无任何问题 且 所有指标达标
    all_passed = all(
        is_passed("alpha", r.get("alpha", 0))
        and is_passed("kmo", r.get("kmo", 0))
        and is_passed("bartlett_p", r.get("bartlett_p_value", 1))
        for r in reliability_results
    ) if reliability_results else True

    passed = all_passed and len(merged_issues) == 0

    return {
        "passed": passed,
        "issues": merged_issues,
    }
