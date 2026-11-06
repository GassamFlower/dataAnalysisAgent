"""文字体检服务单元测试。"""
import json

import pytest

from app.services.ai_tone import (
    MAX_SEMANTIC_ISSUES,
    analyze_text,
    rewrite_text,
    validate_text,
)

BASE_TEXT = (
    "这不是技术问题，而是认知问题。一句话总结：真正的壁垒在于组织愿不愿意改。"
    "对于早期团队来说，招聘和培训最难。然而，团队往往把注意力放在工具上。"
    "当团队规模扩大时，沟通成本会上升。很多公司采用优化、增强、提升的方式描述同一件事。"
    "负责人说，流程、制度和工具要一起改。"
)

REWRITTEN_TEXT = (
    "真正的壁垒在于组织愿不愿意改。早期团队最难的是招聘和培训。"
    "团队往往把注意力放在工具上。团队规模扩大后，沟通成本会上升。"
    "很多公司用优化、增强、提升描述同一件事。负责人说，流程、制度和工具要一起改。"
)


def _mock_payload(**overrides):
    payload = {
        "semantic_issues": [],
        "changes": [{"before": "这不是技术问题，而是认知问题", "after": "认知问题", "rule": "对举句式"}],
        "rewritten_text": REWRITTEN_TEXT,
    }
    payload.update(overrides)
    return json.dumps(payload, ensure_ascii=False)


def test_analyze_detects_actionable_items():
    result = analyze_text(BASE_TEXT)

    assert result["meta"]["hanzi"] >= 50
    names = [item["name"] for group in result["groups"] for item in group["items"]]
    assert "对举句式" in names
    assert "提示语冒号" in names
    assert result["summary"]["actionable"] >= 2


def test_analyze_short_text_marks_distribution_unknown():
    result = analyze_text(BASE_TEXT)
    structure = {item["key"]: item for item in result["structure"]}

    assert structure["iso2_per_100"]["status"] == "unknown"
    assert structure["mtld"]["status"] == "unknown"


def test_analyze_rejects_too_short_text():
    with pytest.raises(ValueError, match="文本太短"):
        analyze_text("太短")


def test_validate_rejects_too_long_text():
    with pytest.raises(ValueError, match="单次最多"):
        validate_text("字" * 8001)


def test_rewrite_returns_before_and_after(monkeypatch):
    captured = {}

    def mock_chat_pro(prompt, system=""):
        captured["prompt"] = prompt
        captured["system"] = system
        return _mock_payload()

    monkeypatch.setattr("app.services.ai_tone.chat_pro", mock_chat_pro)

    result = rewrite_text(BASE_TEXT)

    assert result["text"] == REWRITTEN_TEXT
    assert result["before"]["meta"]["hanzi"] >= 50
    assert result["after"]["meta"]["hanzi"] >= 50
    assert result["changes"][0]["rule"] == "对举句式"
    assert "信息守恒" in captured["prompt"]
    assert "article_text" in captured["prompt"]
    assert "JSON" in captured["system"]


def test_rewrite_limits_semantic_issues(monkeypatch):
    issues = [
        {"type": "rename", "excerpt": f"片段{i}", "reason": "理由"}
        for i in range(MAX_SEMANTIC_ISSUES + 5)
    ]

    def mock_chat_pro(prompt, system=""):
        return _mock_payload(semantic_issues=issues)

    monkeypatch.setattr("app.services.ai_tone.chat_pro", mock_chat_pro)

    result = rewrite_text(BASE_TEXT)

    assert len(result["semantic_issues"]) == MAX_SEMANTIC_ISSUES
    assert all(item["type"] == "rename" for item in result["semantic_issues"])


def test_rewrite_rejects_number_loss(monkeypatch):
    original = BASE_TEXT + "2024 年样本量为 120 人，显著性水平为 0.05。"

    def mock_chat_pro(prompt, system=""):
        return _mock_payload()

    monkeypatch.setattr("app.services.ai_tone.chat_pro", mock_chat_pro)

    with pytest.raises(ValueError, match="数字"):
        rewrite_text(original)


def test_rewrite_rejects_quote_loss(monkeypatch):
    original = BASE_TEXT + "负责人说：“这句话必须保留。”"

    def mock_chat_pro(prompt, system=""):
        return _mock_payload()

    monkeypatch.setattr("app.services.ai_tone.chat_pro", mock_chat_pro)

    with pytest.raises(ValueError, match="引语"):
        rewrite_text(original)


def test_rewrite_rejects_unchanged_text(monkeypatch):
    def mock_chat_pro(prompt, system=""):
        return _mock_payload(rewritten_text=BASE_TEXT)

    monkeypatch.setattr("app.services.ai_tone.chat_pro", mock_chat_pro)

    with pytest.raises(ValueError, match="有效改动"):
        rewrite_text(BASE_TEXT)


def test_rewrite_rejects_invalid_json(monkeypatch):
    def mock_chat_pro(prompt, system=""):
        return "这里不是 JSON"

    monkeypatch.setattr("app.services.ai_tone.chat_pro", mock_chat_pro)

    with pytest.raises(ValueError, match="解析失败"):
        rewrite_text(BASE_TEXT)


def test_rewrite_handles_llm_failure(monkeypatch):
    def mock_chat_pro(prompt, system=""):
        raise RuntimeError("provider down")

    monkeypatch.setattr("app.services.ai_tone.chat_pro", mock_chat_pro)

    with pytest.raises(ValueError, match="暂不可用"):
        rewrite_text(BASE_TEXT)
