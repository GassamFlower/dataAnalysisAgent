"""报告文字润色服务（R6）。

职责：
- 使用 LLM 将统计结果转化为论文段落
- 覆盖信效度、相关矩阵、差异检验、智能诊断四个模块
- 严格约束输出边界：仅生成统计描述，不生成研究结论
- 所有输出强制附加免责声明

设计依据：docs/u-功能-报告文字润色.md
"""
import logging
from typing import Any, Dict, List, Optional

from app.services.ai_tone import (
    analyze_text,
    summarize_actionable,
    validate_rewrite_text,
)
from app.services.llm.client import chat_pro
from app.services.llm.utils import (
    build_prompt_injection_guard,
    parse_llm_json_response,
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

# 论文段落章节（Task 3.1）：方法 / 结果 / 讨论，仅结果规范化、不代写结论
PAPER_SECTIONS = ("method", "result", "discussion")

PAPER_SECTION_LABELS = {
    "method": "研究方法",
    "result": "研究结果",
    "discussion": "讨论",
}

# 论文段落 prompt：只让 LLM 规范化描述实际算出的数字，禁止下研究结论
PAPER_PROMPTS = {
    "method": """你是学术写作助手。请依据本研究所用方法与数据规模，撰写论文「研究方法」部分段落。

要求：
1. 使用 APA 格式
2. 仅描述「用了什么量表维度 / 统计检验 / 样本规模」，不写预期研究结果
3. 若给出预演命中率，可说明「正式全量分析前先做功效预演」作为方法学安排
4. 末尾注明「以上为统计描述参考」

数据：
{data}""",

    "result": """你是学术写作助手。请依据本研究实际统计输出，撰写论文「研究结果」部分段落。

要求：
1. 用 APA 格式如实报告以下实际算出的数字：Cronbach α、各维度 α、差异检验统计量与 p 值、效应量
2. 只能报告数据里出现的数字，严禁编造任何新数值
3. 若给出预演命中率，仅说明「预演层面各假设的检出把握」，不得把命中率当作正式结论
4. 末尾注明「以上为统计描述参考」

数据：
{data}""",

    "discussion": """你是学术写作助手。请依据本研究统计结果，撰写论文「讨论」部分段落。

要求：
1. 仅对已计算出的统计量做规范化解读（数字本身的高低、是否达标）
2. 严格禁止下研究结论或因果判断（禁用词：显著提升 / 显著影响 / 证明假设成立 / 因果 等）
3. 若有预演命中率，只指出「哪些假设在功效层面把握不足，正式研究前需补充样本或复核效应量」
4. 末尾注明「以上为统计描述参考」

数据：
{data}""",
}


# 免责声明
DISCLAIMER = "此为统计描述参考，非研究结论"

# 答辩模拟专属声明：仅统计范式描述，不下研究结论（合规红线）
DEFENSE_DISCLAIMER = "此为答辩准备的统计范式预演描述，非研究结论"

# 第一人称强度档位 → 中文措辞
_STRENGTH_CN = {
    "weak": "较弱",
    "medium": "中等",
    "strong": "较强",
}

_DIRECTION_CN = {
    "positive": "正向",
    "negative": "负向",
}

# 合规自检禁语：答辩/润色文本中命中即告警（语义结论断言，禁止出现在"统计范式描述"里）
_FORBIDDEN_CONCLUSIVE = (
    "显著提升",
    "显著增加",
    "显著降低",
    "具有显著正向影响",
    "显著影响",
    "有效促进",
    "有效提高",
    "因果",
    "证明假设成立",
    "假设得到验证",
    "验证了假设",
    "实验证明",
    "综上可以得出结论",
    "本研究结果表明这一关系成立",
)


def self_check_defense(text: str) -> dict:
    """合规红线自检：统计范式描述中不得出现语义结论断言。

    Returns:
        {"passed": bool, "warnings": list[str], "words": list[str]}
    """
    warnings = []
    words = []
    for word in _FORBIDDEN_CONCLUSIVE:
        if word and word in text:
            words.append(word)
            warnings.append(f"检测到结论性用语「{word}」，请改为仅描述统计结果")
    return {"passed": not words, "warnings": warnings, "words": words}


def tone_summary(text: str) -> Optional[Dict[str, Any]]:
    """对润色结果跑确定性表达检测；文本过短或检测失败时返回 None，不影响主流程。"""
    try:
        return summarize_actionable(analyze_text(text))
    except ValueError:
        return None


def generate_path_qa(path: Dict[str, Any], required_n: int) -> Dict[str, Any]:
    """为单条假设路径生成答辩问答（仅统计范式，不代写结论）。

    Args:
        path: 命中率 item（predictor/outcome/direction/strength/effect_size_r/
              sample_size/hit_rate/target/passed）。
        required_n: 当前效应量下达到目标命中率所需样本量（用于未达标建议）。

    Returns:
        含 question/answer 的字典，与输入 path 字段合并。
    """
    predictor = path["predictor"]
    outcome = path["outcome"]
    direction = path["direction"]
    strength = path.get("strength", "medium")
    r = abs(float(path.get("effect_size_r", 0.0)))
    n = int(path.get("sample_size", 0))
    hit = float(path.get("hit_rate", 0.0))
    target = float(path.get("target", 0.7))
    passed = bool(path.get("passed", False))

    dir_cn = _DIRECTION_CN.get(direction, "相关")
    str_cn = _STRENGTH_CN.get(strength, "中等")
    sign = "正" if direction == "positive" else "负"

    if passed:
        question = (
            f"评审可能问：你的预演里，「{predictor}」与「{outcome}」的{dir_cn}关系"
            f"有多大把握能在正式分析中被检出？"
        )
        answer = (
            f"（统计范式回答）在本次预演中，我把该假设建模为{str_cn}的{sign}向相关"
            f"（效应量 r={r:.2f}），样本量 N={n}。按该效应量检验的把握度为 "
            f"{hit * 100:.0f}%，已超过目标 {target * 100:.0f}%，"
            f"说明在此样本量下该关系有较高概率被检出。"
        )
    else:
        question = (
            f"评审可能问：这条「{predictor}」与「{outcome}」的假设，为什么预演里"
            f"命中把握不够？是效应太弱还是样本太少？"
        )
        target_n = int(path.get("required_n", required_n))
        answer = (
            f"（统计范式回答）该假设建模为{str_cn}的{sign}向相关（r={r:.2f}），"
            f"当前 N={n} 时检出把握度为 {hit * 100:.0f}%，低于目标 {target * 100:.0f}%。"
            f"若要保持此效应量，建议将样本量提升到约 {target_n}；"
            f"或在先验里把预期相关强度上调（提高 r），再重新预演校准。"
        )

    return {**path, "question": question, "answer": answer}


def assemble_defense_summary(
    paths: List[Dict[str, Any]],
    overall: float,
    alpha: float = 0.05,
    target: float = 0.7,
) -> Dict[str, Any]:
    """把逐路径命中率汇总成答辩模拟摘要。

    Args:
        paths: analyze_hypothesis_power 返回的 paths items。
        overall: 达标率（0~1）。
        alpha/target: 检验显著性 / 命中率达标线。

    Returns:
        {
            "section": "defense",
            "text": str（可复制全文，含声明）,
            "disclaimer": str,
            "passed_count": int,
            "total_count": int,
            "overall": float,
            "items": [ {..., question, answer} ],
        }
    """
    from app.services.sample_size_planner import required_n_correlation

    passed_count = sum(1 for p in paths if p.get("passed"))
    total = len(paths)

    items = []
    for p in paths:
        r = abs(float(p.get("effect_size_r", 0.0)))
        req_n = 0
        if r > 0 and r < 1:
            try:
                # 联动样本量规划：达到目标命中率所需 N
                req_n = required_n_correlation(r, alpha=alpha, power=target)
            except ValueError:
                req_n = 0
        item = generate_path_qa({**p, "required_n": req_n}, req_n)
        items.append(item)

    lines = [
        f"本次预演共 {total} 条假设路径，达标（命中率 ≥{target * 100:.0f}%）"
        f"{passed_count} 条，整体命中率 {overall * 100:.0f}%。",
        "",
    ]
    for idx, item in enumerate(items, start=1):
        lines.append(f"{idx}. {item['question']}")
        lines.append(f"   {item['answer']}")
        lines.append("")
    lines.append(DEFENSE_DISCLAIMER)

    text = "\n".join(lines).strip()

    return {
        "section": "defense",
        "text": text,
        "disclaimer": DEFENSE_DISCLAIMER,
        "passed_count": passed_count,
        "total_count": total,
        "overall": float(round(overall, 3)),
        "items": items,
    }


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
        response = chat_pro(prompt)
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
        "tone": tone_summary(text),
    }


def _section_payload(report_data: Dict[str, Any], section: str) -> Dict[str, Any]:
    """按章节抽取报告数据（润色与再润色共用）。"""
    if section == "reliability":
        return {
            "reliability_results": report_data.get("reliability_results", []),
            "overall_alpha": report_data.get("overall_alpha"),
            "passed_count": report_data.get("passed_count"),
            "total_count": report_data.get("total_count"),
        }
    if section == "correlation":
        diff_tests = report_data.get("diff_tests", [])
        return {
            "correlation_tests": [t for t in diff_tests if t.get("method") == "pearson"]
        }
    if section == "diff_test":
        return {"diff_tests": report_data.get("diff_tests", [])}
    if section == "diagnosis":
        return {"diagnosis": report_data.get("diagnosis")}
    if section in PAPER_SECTIONS:
        return _build_paper_excerpt(report_data, section)
    return {}


def _build_polish_prompt(report_data: Dict[str, Any], section: str) -> str:
    """构建润色 prompt。"""
    import json

    data = _section_payload(report_data, section)
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


# ---------------------------------------------------------------------------
# 论文段落生成（Task 3.1）：方法 / 结果 / 讨论，仅结果规范化、不代写结论
# ---------------------------------------------------------------------------


def _hit_flat(hit: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """把预演命中率摘要拍平为 LLM 友好结构（无则 None）。"""
    if not hit:
        return None
    paths = [
        {
            "假设路径": f"{p.get('predictor')}→{p.get('outcome')}",
            "命中率": p.get("hit_rate"),
            "达标": p.get("passed"),
        }
        for p in (hit.get("paths") or [])
    ]
    return {
        "整体命中率": hit.get("overall"),
        "达标路径数": f"{hit.get('passed_count', 0)}/{hit.get('total_count', 0)}",
        "路径": paths,
    }


def _build_paper_excerpt(report_data: Dict[str, Any], section: str) -> Dict[str, Any]:
    """确定性提取论文段落所需的实际数字（仅本系统已算出值，不引入新数）。"""
    reliability = report_data.get("reliability_results", [])
    diff_tests = report_data.get("diff_tests", [])
    hit = _hit_flat(report_data.get("hit_rate"))

    if section == "method":
        dims = [r.get("dimension") for r in reliability if r.get("dimension")]
        methods = sorted(
            {t.get("method_name") for t in diff_tests if t.get("method_name")}
        )
        return {
            "样本规模": report_data.get("sample_size"),
            "量表维度": dims,
            "使用的统计检验": methods,
            "是否有预演": bool(hit),
        }

    if section == "result":
        return {
            "总量表Cronbach_alpha": report_data.get("overall_alpha"),
            "达标维度计数": {
                "passed": report_data.get("passed_count"),
                "total": report_data.get("total_count"),
            },
            "各维度信度": [
                {"维度": r.get("dimension"), "alpha": r.get("alpha")}
                for r in reliability
            ],
            "差异检验": [
                {
                    "自变量": t.get("predictor"),
                    "因变量": t.get("outcome"),
                    "方法": t.get("method_name"),
                    "统计量": t.get("statistic"),
                    "p值": t.get("p_value"),
                    "是否显著": t.get("significant"),
                }
                for t in diff_tests
            ],
            "预演命中率": hit,
        }

    # discussion
    issues = (report_data.get("diagnosis") or {}).get("issues", [])
    return {
        "诊断问题": [
            {
                "维度": d.get("dimension"),
                "指标": d.get("metric"),
                "原因": d.get("reason"),
                "建议": d.get("suggestion"),
            }
            for d in issues
        ],
        "差异检验显著项数": sum(1 for t in diff_tests if t.get("significant")),
        "预演达标情况": hit,
    }


def polish_paper_section(report_data: Dict[str, Any], section: str) -> Dict[str, Any]:
    """生成论文段落（方法/结果/讨论）。

    - 数字全部取自 report_data（实际统计输出 + 可选预演命中率），不编造。
    - 仅结果规范化描述，不下研究结论；生成后跑红线自检。

    Returns:
        {section, text, disclaimer, redline}
        redline: {"passed": bool, "warnings": list, "words": list}
    """
    if section not in PAPER_SECTIONS:
        raise ValueError(f"不支持的论文段落章节类型: {section}")

    import json

    excerpt = _build_paper_excerpt(report_data, section)
    wrapped = wrap_user_input(
        json.dumps(excerpt, ensure_ascii=False, indent=2), label="paper_data"
    )
    prompt = PAPER_PROMPTS[section].format(data=wrapped)
    prompt = f"{build_prompt_injection_guard()}\n\n{prompt}"

    try:
        text = _post_process(chat_pro(prompt))
    except Exception as e:
        logger.warning(
            "论文段落 LLM 失败，降级为静态模板 | section=%s | error=%s",
            section,
            e,
            exc_info=True,
        )
        text = _fallback_paper(report_data, section)

    redline = self_check_defense(text)
    return {
        "section": section,
        "text": text,
        "disclaimer": DISCLAIMER,
        "redline": redline,
        "tone": tone_summary(text),
    }


REFINE_PROMPT = """你是严谨的学术写作编辑。下面这段文字已由系统根据统计结果生成，请按体检清单做最小改写。

硬性要求：
1. 只改清单命中的位置和同类表达问题，不整段重写。
2. 信息守恒：数字、百分比、p 值、统计量、姓名、引语、来源原样保留。
3. 段落数量与顺序不变，不增删标题、列表、表格、引用。
4. 不新增原文没有的事实、数字或判断。
5. 不添加结论性用语（如「显著提升」「显著影响」「证明假设成立」「因果」）。
6. 保留末尾的统计描述声明。

体检清单：
{checklist}

参考数据（只用于确认事实，不得据此新增数字）：
{data}

待改写文字：
{text}

只输出 JSON，不要 Markdown 代码块，不要解释：
{{"rewritten_text":"完整改写稿"}}"""


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("\n", 1)[1] if "\n" in stripped else stripped[3:]
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]
    return stripped.strip()


def _build_checklist(summary: Dict[str, Any]) -> str:
    lines: List[str] = []
    for item in summary.get("items", []):
        lines.append(
            f"- [{item['level']}] {item['name']}：{item['count']} 处；{item['advice']}"
        )
        for excerpt in item.get("examples", [])[:2]:
            lines.append(f"  例：「{excerpt}」")
    for item in summary.get("fingerprints", []):
        lines.append(
            f"- [F] {item['label']}：{item['density']}/千字；{item['note']}"
        )
    return "\n".join(lines) if lines else "- 无"


def refine_with_tone(
    report_data: Dict[str, Any],
    section: str,
    current_text: str,
) -> Dict[str, Any]:
    """按已生成的表达体检清单，对润色结果再做一次最小改写。

    - 只复用报告数据作为事实边界，不引入新数字。
    - 改写后校验数字与引语守恒；论文段落额外检查结论性用语。
    """
    import json

    if section not in SECTION_PROMPTS and section not in PAPER_SECTIONS:
        raise ValueError(f"不支持的章节类型: {section}")

    normalized = (current_text or "").replace("\r\n", "\n").strip()
    analysis = analyze_text(normalized)
    before = summarize_actionable(analysis)
    if before["actionable"] == 0:
        raise ValueError("这段文字没有检测到可改的表达问题。")

    data = _section_payload(report_data, section)
    prompt = REFINE_PROMPT.format(
        checklist=_build_checklist(before),
        data=wrap_user_input(
            json.dumps(data, ensure_ascii=False, indent=2), label=f"{section}_data"
        ),
        text=wrap_user_input(normalized, label="current_text"),
    )
    prompt = f"{build_prompt_injection_guard()}\n\n{prompt}"

    try:
        raw = chat_pro(
            prompt,
            system="你是严谨的学术写作编辑。只输出符合要求的 JSON，不输出其他内容。",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("按体检项再润色 LLM 失败 | section=%s | error=%s", section, exc)
        raise ValueError("润色服务暂不可用，请稍后重试。") from exc

    try:
        payload = parse_llm_json_response(raw)
    except ValueError as exc:
        logger.warning("再润色结果解析失败 | section=%s | raw=%s", section, raw[:200])
        raise ValueError("润色结果解析失败，请重试。") from exc

    rewritten = _strip_code_fence(str(payload.get("rewritten_text") or ""))
    if not rewritten:
        raise ValueError("润色结果为空，请重试。")

    rewritten = _post_process(rewritten)
    validate_rewrite_text(normalized, rewritten)

    redline = self_check_defense(rewritten)
    if section in PAPER_SECTIONS:
        before_words = set(self_check_defense(normalized)["words"])
        new_words = [word for word in redline["words"] if word not in before_words]
        if new_words:
            raise ValueError(
                "再润色引入了结论性用语（" + "、".join(new_words) + "），已拒绝本次结果。"
            )

    after = summarize_actionable(analyze_text(rewritten, strict=False))
    after["previous_actionable"] = before["actionable"]

    return {
        "section": section,
        "text": rewritten,
        "disclaimer": DISCLAIMER,
        "redline": redline if section in PAPER_SECTIONS else None,
        "tone": after,
    }


def _fallback_paper(report_data: Dict[str, Any], section: str) -> str:
    """论文段落降级为静态模板（LLM 失败时使用，仍只报实际数字）。"""
    overall = report_data.get("overall_alpha")
    reliability = report_data.get("reliability_results", [])

    if section == "method":
        dims = [r.get("dimension") for r in reliability if r.get("dimension")]
        methods = sorted(
            {t.get("method_name") for t in report_data.get("diff_tests", []) if t.get("method_name")}
        )
        line = f"本研究使用 {len(dims)} 个维度量测量构念"
        if methods:
            line += f"，检验方法包括 {', '.join(methods)}"
        return f"{line}。\n\n{DISCLAIMER}"

    if section == "result":
        if overall is None:
            return f"暂无信度结果。\n\n{DISCLAIMER}"
        return f"总量表 Cronbach's α = {float(overall):.3f}。\n\n{DISCLAIMER}"

    passed = report_data.get("passed_count", 0)
    total = report_data.get("total_count", 0)
    return f"信度维度 {passed}/{total} 个达标。\n\n{DISCLAIMER}"
