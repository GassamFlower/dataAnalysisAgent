"""报告文字润色服务（R6）。

职责：
- 使用 LLM 将统计结果转化为论文段落
- 覆盖信效度、相关矩阵、差异检验、R4 诊断四个模块
- 严格约束输出边界：仅生成统计描述，不生成研究结论
- 所有输出强制附加免责声明

设计依据：docs/u-功能-报告文字润色.md
"""
import logging
from typing import Any, Dict

from app.services.llm.client import chat_r1
from app.services.llm.utils import (
    build_prompt_injection_guard,
    wrap_user_input,
)

logger = logging.getLogger(__name__)

# 各章节的 prompt 模板
SECTION_PROMPTS = {
    "reliability": """你是心理学测量专家。请根据以下信效度结果，撰写论文"研究方法-信效度检验"部分的段落。

要求：
1. 使用 APA 格式
2. 仅描述统计结果，不下研究结论
3. 包含 α、KMO、Bartlett 值及分档判定
4. 末尾注明"以上为统计描述参考"

信效度结果：
{data}""",

    "correlation": """你是统计分析专家。请根据以下相关系数矩阵，撰写论文"研究结果-相关分析"部分的段落。

要求：
1. 使用 APA 格式报告 r 值和显著性
2. 仅描述相关关系，不推断因果
3. 末尾注明"以上为统计描述参考"

相关分析结果：
{data}""",

    "diff_test": """你是统计分析专家。请根据以下差异检验结果，撰写论文"研究结果-差异分析"部分的段落。

要求：
1. 报告统计量、p 值、效应量
2. 仅描述检验结果，不推断因果
3. 末尾注明"以上为统计描述参考"

差异检验结果：
{data}""",

    "diagnosis": """你是心理学测量专家。请根据以下诊断结果，撰写论文"讨论-量表质量评估"部分的参考段落。

要求：
1. 客观描述问题
2. 给出可操作的修改建议
3. 不下最终结论
4. 末尾注明"以上为统计描述参考"

诊断结果：
{data}""",
}

# 免责声明
DISCLAIMER = "此为统计描述参考，非研究结论"


def polish_section(report_data: Dict[str, Any], section: str) -> Dict[str, Any]:
    """润色指定章节。

    Args:
        report_data: 报告数据（包含 reliability_results/diff_tests/diagnosis 等）
        section: 章节名称（reliability/correlation/diff_test/diagnosis）

    Returns:
        {
            "section": str,
            "text": str,
            "disclaimer": str
        }
    """
    if section not in SECTION_PROMPTS:
        raise ValueError(f"不支持的章节类型: {section}")

    # 构建 prompt
    prompt = _build_polish_prompt(report_data, section)

    # 调用 LLM
    try:
        response = chat_r1(prompt)
        text = _post_process(response)
    except Exception as e:
        logger.warning(
            "LLM 润色失败，降级为静态模板 | section=%s | error=%s",
            section,
            e,
            exc_info=True,
        )
        # 降级为静态模板
        text = _fallback_template(report_data, section)

    return {
        "section": section,
        "text": text,
        "disclaimer": DISCLAIMER,
    }


def _build_polish_prompt(report_data: Dict[str, Any], section: str) -> str:
    """构建润色 prompt。"""
    import json

    # 提取对应章节的数据
    if section == "reliability":
        data = {
            "reliability_results": report_data.get("reliability_results", []),
            "overall_alpha": report_data.get("overall_alpha"),
            "passed_count": report_data.get("passed_count"),
            "total_count": report_data.get("total_count"),
        }
    elif section == "correlation":
        # 从 diff_tests 中提取 Pearson 相关
        diff_tests = report_data.get("diff_tests", [])
        pearson_tests = [t for t in diff_tests if t.get("method") == "pearson"]
        data = {"correlation_tests": pearson_tests}
    elif section == "diff_test":
        data = {"diff_tests": report_data.get("diff_tests", [])}
    elif section == "diagnosis":
        data = {"diagnosis": report_data.get("diagnosis")}
    else:
        data = {}

    data_json = json.dumps(data, ensure_ascii=False, indent=2)
    wrapped_data = wrap_user_input(data_json, label=f"{section}_data")

    prompt_template = SECTION_PROMPTS[section]
    prompt = prompt_template.format(data=wrapped_data)

    # 添加 prompt injection 防护
    guard = build_prompt_injection_guard()
    prompt = f"{guard}\n\n{prompt}"

    return prompt


def _post_process(text: str) -> str:
    """后处理 LLM 输出，确保包含免责声明。"""
    # 检查是否已包含免责声明
    if "统计描述参考" not in text and "研究结论" not in text:
        text = f"{text}\n\n{DISCLAIMER}"

    return text.strip()


def _fallback_template(report_data: Dict[str, Any], section: str) -> str:
    """降级为静态模板（LLM 失败时使用）。"""
    if section == "reliability":
        return _fallback_reliability(report_data)
    elif section == "correlation":
        return _fallback_correlation(report_data)
    elif section == "diff_test":
        return _fallback_diff_test(report_data)
    elif section == "diagnosis":
        return _fallback_diagnosis(report_data)
    else:
        return f"暂无{section}的润色结果。\n\n{DISCLAIMER}"


def _fallback_reliability(report_data: Dict[str, Any]) -> str:
    """信效度静态模板。"""
    reliability_results = report_data.get("reliability_results", [])
    overall_alpha = report_data.get("overall_alpha", 0)

    if not reliability_results:
        return f"暂无信效度数据。\n\n{DISCLAIMER}"

    dim_count = len(reliability_results)
    alphas = [r.get("alpha", 0) for r in reliability_results]
    min_alpha = min(alphas) if alphas else 0
    max_alpha = max(alphas) if alphas else 0

    text = (
        f"本量表共 {dim_count} 个维度。"
        f"信度检验显示，总量表 Cronbach's α = {overall_alpha:.3f}，"
        f"各维度 α 介于 {min_alpha:.3f}～{max_alpha:.3f}。"
        f"\n\n{DISCLAIMER}"
    )
    return text


def _fallback_correlation(report_data: Dict[str, Any]) -> str:
    """相关分析静态模板。"""
    diff_tests = report_data.get("diff_tests", [])
    pearson_tests = [t for t in diff_tests if t.get("method") == "pearson"]

    if not pearson_tests:
        return f"暂无相关分析数据。\n\n{DISCLAIMER}"

    text = f"共进行 {len(pearson_tests)} 组相关分析。\n\n{DISCLAIMER}"
    return text


def _fallback_diff_test(report_data: Dict[str, Any]) -> str:
    """差异检验静态模板。"""
    diff_tests = report_data.get("diff_tests", [])

    if not diff_tests:
        return f"暂无差异检验数据。\n\n{DISCLAIMER}"

    significant_count = sum(1 for t in diff_tests if t.get("significant"))
    text = (
        f"共进行 {len(diff_tests)} 组差异检验，"
        f"其中 {significant_count} 组达到显著性水平。\n\n{DISCLAIMER}"
    )
    return text


def _fallback_diagnosis(report_data: Dict[str, Any]) -> str:
    """诊断结论静态模板。"""
    diagnosis = report_data.get("diagnosis")

    if not diagnosis:
        return f"暂无诊断数据。\n\n{DISCLAIMER}"

    passed = diagnosis.get("passed", False)
    issues = diagnosis.get("issues", [])

    if passed:
        text = "诊断结果显示量表质量良好，未发现显著问题。\n\n" + DISCLAIMER
    else:
        text = (
            f"诊断结果显示存在 {len(issues)} 个问题，"
            f"建议根据具体问题逐一修改。\n\n{DISCLAIMER}"
        )
    return text
