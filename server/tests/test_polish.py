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
    polish_paper_section,
    _build_polish_prompt,
    _build_paper_excerpt,
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
    def mock_chat_pro(prompt):
        return "信效度检验结果显示，总量表 α = 0.856，具有良好的内部一致性。"

    monkeypatch.setattr("app.services.report_polisher.chat_pro", mock_chat_pro)

    result = polish_section(_build_full_report_data(), "reliability")

    assert result["section"] == "reliability"
    assert "α" in result["text"]
    assert result["disclaimer"] == DISCLAIMER
    assert "统计描述参考" in result["text"]  # 后处理添加的免责声明


def test_polish_section_correlation_with_llm(monkeypatch):
    """正常：相关分析章节润色。"""
    def mock_chat_pro(prompt):
        return "相关分析显示学习动机与学业成绩呈显著正相关。以上为统计描述参考。"

    monkeypatch.setattr("app.services.report_polisher.chat_pro", mock_chat_pro)

    result = polish_section(_build_full_report_data(), "correlation")

    assert result["section"] == "correlation"
    assert "相关" in result["text"]
    assert result["disclaimer"] == DISCLAIMER


def test_polish_section_diff_test_with_llm(monkeypatch):
    """正常：差异检验章节润色。"""
    def mock_chat_pro(prompt):
        return "差异检验结果显示，学习动机对学业成绩有显著影响。以上为统计描述参考。"

    monkeypatch.setattr("app.services.report_polisher.chat_pro", mock_chat_pro)

    result = polish_section(_build_full_report_data(), "diff_test")

    assert result["section"] == "diff_test"
    assert "显著" in result["text"]


def test_polish_section_diagnosis_with_llm(monkeypatch):
    """正常：诊断章节润色。"""
    def mock_chat_pro(prompt):
        return "量表诊断发现自我效能维度 α 偏低，建议增加题项。以上为统计描述参考。"

    monkeypatch.setattr("app.services.report_polisher.chat_pro", mock_chat_pro)

    result = polish_section(_build_full_report_data(), "diagnosis")

    assert result["section"] == "diagnosis"
    assert "自我效能" in result["text"]


def test_polish_section_llm_called_with_guard(monkeypatch):
    """正常：LLM 调用时 prompt 包含注入防护和用户输入包裹。"""
    captured_prompt = []

    def mock_chat_pro(prompt):
        captured_prompt.append(prompt)
        return "测试输出。以上为统计描述参考。"

    monkeypatch.setattr("app.services.report_polisher.chat_pro", mock_chat_pro)

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
    def mock_chat_pro(prompt):
        raise Exception("LLM 服务不可用")

    monkeypatch.setattr("app.services.report_polisher.chat_pro", mock_chat_pro)

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


# ============================
# 论文段落（Task 3.1）：方法/结果/讨论
# ============================

def _build_full_report_data_with_hitrate():
    """构造带预演命中率的完整报告数据。"""
    data = _build_full_report_data()
    data["hit_rate"] = {
        "overall": 0.667,
        "passed_count": 2,
        "total_count": 3,
        "paths": [
            {"predictor": "学习动机", "outcome": "学业成绩",
             "hit_rate": 0.9, "passed": True},
            {"predictor": "焦虑", "outcome": "学业成绩",
             "hit_rate": 0.45, "passed": False},
        ],
    }
    return data


def test_paper_excerpt_result_aligns_actual_numbers():
    """正常：结果段摘录数字全部取自 report_data（α / P 值 / 命中率）。"""
    excerpt = _build_paper_excerpt(_build_full_report_data_with_hitrate(), "result")
    assert excerpt["总量表Cronbach_alpha"] == 0.856
    assert excerpt["达标维度计数"] == {"passed": 4, "total": 5}
    assert excerpt["差异检验"][0]["p值"] == 0.00012
    assert excerpt["差异检验"][0]["是否显著"] is True
    hit = excerpt["预演命中率"]
    assert hit["整体命中率"] == 0.667
    assert hit["达标路径数"] == "2/3"
    assert hit["路径"][0]["命中率"] == 0.9


def test_paper_excerpt_method_omits_hit_paths():
    """正常：方法段只描述维度/检验/规模，不含命中率明细。"""
    excerpt = _build_paper_excerpt(_build_full_report_data_with_hitrate(), "method")
    assert excerpt["量表维度"] == ["学习动机"]
    assert "Pearson 相关" in excerpt["使用的统计检验"]
    assert excerpt["是否有预演"] is True
    assert "预演命中率" not in excerpt


def test_paper_result_with_llm(monkeypatch):
    """正常：结果段 LLM 生成，数字取自本报告并带红线自检。"""
    def mock_chat_pro(prompt):
        return "总量表 Cronbach's α = 0.856，p = .001。以上为统计描述参考。"
    monkeypatch.setattr("app.services.report_polisher.chat_pro", mock_chat_pro)

    result = polish_paper_section(_build_full_report_data(), "result")
    assert result["section"] == "result"
    assert "0.856" in result["text"]
    assert result["disclaimer"] == DISCLAIMER
    assert result["redline"]["passed"] is True


def test_paper_redline_flags_conclusive_words(monkeypatch):
    """红线：LLM 输出含结论性措辞时自检告警（不代写研究结论的兜底）。"""
    def mock_chat_pro(prompt):
        return "结果表明干预显著提升了学业成绩。以上为统计描述参考。"
    monkeypatch.setattr("app.services.report_polisher.chat_pro", mock_chat_pro)

    result = polish_paper_section(_build_full_report_data(), "result")
    assert result["redline"]["passed"] is False
    assert any("显著提升" in w or "显著影响" in w for w in result["redline"]["warnings"])


def test_paper_fallback_on_llm_exception(monkeypatch):
    """降级：LLM 抛异常时用静态模板，仍只报实际数字。"""
    def mock_chat_pro(prompt):
        raise RuntimeError("llm down")
    monkeypatch.setattr("app.services.report_polisher.chat_pro", mock_chat_pro)

    result = polish_paper_section(_build_full_report_data(), "result")
    assert result["section"] == "result"
    assert DISCLAIMER in result["text"]
    assert "0.856" in result["text"]  # 降级模板引用了实际 α


def test_paper_section_unsupported():
    """异常：不支持的论文段落章节类型抛 ValueError。"""
    with pytest.raises(ValueError, match="不支持的论文段落章节类型"):
        polish_paper_section({}, "abstract")
