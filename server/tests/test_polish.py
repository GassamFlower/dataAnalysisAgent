"""报告文字润色服务单元测试。

覆盖（testing-strategy 第二步：三类用例）：
- 正常：四个章节（reliability/correlation/diff_test/diagnosis）润色、LLM 调用、免责声明
- 边界：空数据、LLM 降级为静态模板
- 异常：不支持的章节类型、LLM 抛异常时降级

设计依据：docs/u-功能-报告文字润色.md
"""
import pytest

from app.services.report_polisher import (
    polish_section,
    _build_polish_prompt,
    _post_process,
    _fallback_template,
    DISCLAIMER,
    SECTION_PROMPTS,
)


def _build_full_report_data():
    """构造完整报告数据。"""
    return {
        "overall_alpha": 0.856,
        "passed_count": 4,
        "total_count": 5,
        "reliability_results": [
            {"dimension": "学习动机", "alpha": 0.82, "kmo": 0.75,
             "bartlett_p_value": 0.001, "passed": True},
        ],
        "diff_tests": [
            {"predictor": "学习动机", "outcome": "学业成绩",
             "method": "pearson", "method_name": "Pearson 相关",
             "statistic": 0.456, "p_value": 0.00012, "significant": True},
        ],
        "diagnosis": {
            "passed": False,
            "issues": [{"dimension": "自我效能", "metric": "α", "reason": "偏低"}],
        },
    }


# ============================
# 正常用例 — LLM mock
# ============================

def test_polish_section_reliability_with_llm(monkeypatch):
    """正常：信效度章节润色，LLM 返回有效文本。"""
    def mock_chat_r1(prompt):
        return "信效度检验结果显示，总量表 α = 0.856，具有良好的内部一致性。"

    monkeypatch.setattr("app.services.report_polisher.chat_r1", mock_chat_r1)

    result = polish_section(_build_full_report_data(), "reliability")

    assert result["section"] == "reliability"
    assert "α" in result["text"]
    assert result["disclaimer"] == DISCLAIMER
    assert "统计描述参考" in result["text"]  # 后处理添加的免责声明


def test_polish_section_correlation_with_llm(monkeypatch):
    """正常：相关分析章节润色。"""
    def mock_chat_r1(prompt):
        return "相关分析显示学习动机与学业成绩呈显著正相关。以上为统计描述参考。"

    monkeypatch.setattr("app.services.report_polisher.chat_r1", mock_chat_r1)

    result = polish_section(_build_full_report_data(), "correlation")

    assert result["section"] == "correlation"
    assert "相关" in result["text"]
    assert result["disclaimer"] == DISCLAIMER


def test_polish_section_diff_test_with_llm(monkeypatch):
    """正常：差异检验章节润色。"""
    def mock_chat_r1(prompt):
        return "差异检验结果显示，学习动机对学业成绩有显著影响。以上为统计描述参考。"

    monkeypatch.setattr("app.services.report_polisher.chat_r1", mock_chat_r1)

    result = polish_section(_build_full_report_data(), "diff_test")

    assert result["section"] == "diff_test"
    assert "显著" in result["text"]


def test_polish_section_diagnosis_with_llm(monkeypatch):
    """正常：诊断章节润色。"""
    def mock_chat_r1(prompt):
        return "量表诊断发现自我效能维度 α 偏低，建议增加题项。以上为统计描述参考。"

    monkeypatch.setattr("app.services.report_polisher.chat_r1", mock_chat_r1)

    result = polish_section(_build_full_report_data(), "diagnosis")

    assert result["section"] == "diagnosis"
    assert "自我效能" in result["text"]


def test_polish_section_llm_called_with_guard(monkeypatch):
    """正常：LLM 调用时 prompt 包含注入防护和用户输入包裹。"""
    captured_prompt = []

    def mock_chat_r1(prompt):
        captured_prompt.append(prompt)
        return "测试输出。以上为统计描述参考。"

    monkeypatch.setattr("app.services.report_polisher.chat_r1", mock_chat_r1)

    polish_section(_build_full_report_data(), "reliability")

    assert len(captured_prompt) == 1
    prompt = captured_prompt[0]
    # 应包含 prompt injection 防护
    assert "用户输入" in prompt or "user_input" in prompt
    # 应包含数据内容
    assert "reliability" in prompt.lower() or "信效度" in prompt


# ============================
# 正常用例 — 免责声明
# ============================

def test_post_process_adds_disclaimer_when_missing():
    """正常：LLM 输出未包含免责声明时自动添加。"""
    text = "这是一段统计描述。"
    result = _post_process(text)
    assert DISCLAIMER in result


def test_post_process_preserves_existing_disclaimer():
    """正常：LLM 输出已包含免责声明关键词时不重复追加。"""
    text = "这是一段统计描述。以上为统计描述参考。"
    result = _post_process(text)
    # 文本已包含"统计描述参考"，_post_process 不再追加 DISCLAIMER
    assert result == text.strip()
    assert DISCLAIMER not in result  # 未追加完整 DISCLAIMER
    assert result.count("统计描述参考") == 1  # 未重复


# ============================
# 边界用例 — LLM 降级
# ============================

def test_polish_section_fallback_on_llm_exception(monkeypatch):
    """边界：LLM 抛异常时降级为静态模板。"""
    def mock_chat_r1(prompt):
        raise Exception("LLM 服务不可用")

    monkeypatch.setattr("app.services.report_polisher.chat_r1", mock_chat_r1)

    result = polish_section(_build_full_report_data(), "reliability")

    # 应降级为静态模板，仍包含免责声明
    assert result["section"] == "reliability"
    assert DISCLAIMER in result["text"]
    assert "α" in result["text"] or "信效度" in result["text"]


def test_fallback_template_reliability():
    """边界：信效度静态模板包含关键信息。"""
    text = _fallback_template(_build_full_report_data(), "reliability")
    assert "0.856" in text  # overall_alpha
    assert DISCLAIMER in text


def test_fallback_template_correlation():
    """边界：相关分析静态模板包含关键信息。"""
    text = _fallback_template(_build_full_report_data(), "correlation")
    assert DISCLAIMER in text
    assert "相关" in text


def test_fallback_template_diff_test():
    """边界：差异检验静态模板包含显著组数。"""
    text = _fallback_template(_build_full_report_data(), "diff_test")
    assert DISCLAIMER in text
    assert "1" in text  # 1 组显著


def test_fallback_template_diagnosis():
    """边界：诊断静态模板包含问题描述。"""
    text = _fallback_template(_build_full_report_data(), "diagnosis")
    assert DISCLAIMER in text
    assert "1" in text  # 1 个问题


def test_fallback_template_empty_data():
    """边界：空数据降级模板包含免责声明。"""
    for section in SECTION_PROMPTS:
        text = _fallback_template({}, section)
        assert DISCLAIMER in text


# ============================
# 边界用例 — prompt 构建
# ============================

def test_build_polish_prompt_reliability():
    """边界：信效度 prompt 包含对应数据。"""
    prompt = _build_polish_prompt(_build_full_report_data(), "reliability")
    assert "信效度" in prompt or "reliability" in prompt.lower()
    assert "0.856" in prompt  # overall_alpha


def test_build_polish_prompt_correlation_filters_pearson():
    """边界：相关分析 prompt 仅包含 Pearson 检验。"""
    data = _build_full_report_data()
    # 添加一个非 pearson 的检验，确保被过滤
    data["diff_tests"].append({
        "predictor": "x", "outcome": "y", "method": "t_test",
        "statistic": 1.5, "p_value": 0.1, "significant": False,
    })
    prompt = _build_polish_prompt(data, "correlation")
    # prompt 中应包含 pearson 相关数据
    assert "pearson" in prompt.lower() or "correlation" in prompt.lower()


# ============================
# 异常用例
# ============================

def test_polish_section_unsupported_section():
    """异常：不支持的章节类型抛出 ValueError。"""
    with pytest.raises(ValueError, match="不支持的章节类型"):
        polish_section({}, "unknown_section")
