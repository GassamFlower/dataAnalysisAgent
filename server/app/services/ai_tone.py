"""文字体检（去 AI 味）服务。

检测层为确定性规则，改写层由 LLM 完成。
方法参考公开的人机写作对照研究，未复用其源码与文案。

边界：
- 只报告整篇分布指标，不把句长/结构问题拆成逐句错误。
- 改写只处理可定位的局部命中，未知来源文本不做模型来源推断。
- 改写后校验数字与引文守恒，失败即拒绝返回。
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from app.services.llm.client import chat_pro
from app.services.llm.utils import (
    build_prompt_injection_guard,
    parse_llm_json_response,
    wrap_user_input,
)

logger = logging.getLogger(__name__)

MAX_TEXT_CHARS = 8000
MIN_TEXT_CHARS = 80
MIN_HANZI = 50
MAX_EXAMPLES_PER_RULE = 5
MAX_SEMANTIC_ISSUES = 5
MAX_CHANGES = 20

LEVEL_TITLES = {
    "A": "可直接改写",
    "B": "建议改写",
    "F": "标点指纹",
    "C": "结构提示",
    "X": "保持不变",
    "H": "建议人工判断",
}

DISCLAIMER = (
    "改写由 AI 辅助完成，请逐句核对事实、数字与引文；"
    "AI 参与写作的部分请按学校或期刊要求声明。"
)

_HANZI_RE = re.compile(r"[\u4e00-\u9fff]")
_SENTENCE_SPLIT = re.compile(r"[。！？；]")
_HEADING_RE = re.compile(r"^#{1,6}\s")
_BOLD_HEADING_RE = re.compile(r"^\*\*[^*]{2,40}\*\*$")
_NUMBER_RE = re.compile(r"\d+(?:\.\d+)?%?")
_QUOTE_RE = re.compile(r"“([^”]{2,80})”")

_TEXT_RULES: List[Dict[str, Any]] = [
    {
        "id": "contrast",
        "level": "A",
        "name": "对举句式",
        "pattern": r"(?:不是|并非|不在于|与其说)[^，。！？\n]{1,20}[，]?(?:而是|而在于|不如说)",
        "reference": "0.22 次/千字",
        "advice": "直接给出判断，保留原文的事实、范围和限定词，不把反面信息整句删掉。",
    },
    {
        "id": "prompt_colon",
        "level": "A",
        "name": "提示语冒号",
        "pattern": (
            r"(?:一句话(?:总结|说|概括)|简单说|说白了|总结|小结|结论|核心(?:是|在于)?"
            r"|关键(?:是|在于)?|重点(?:是)?|原因(?:如下|有|在于)?|问题(?:是|在于)?"
            r"|答案(?:是)?|本质(?:是|上)?|具体(?:来说|如下|包括)?|举例(?:来说)?"
            r"|换句话说|也就是说|我的(?:观点|判断|结论)|建议(?:是)?)[：:]"
        ),
        "reference": "0.08 次/千字",
        "advice": "提示语不承担信息时删掉直接写；前半句承接上文时只把冒号换成句号或逗号。",
    },
    {
        "id": "opening",
        "level": "A",
        "name": "起手式",
        "pattern": r"(?:说白了|说穿了|先说结论)[，,]",
        "reference": "0.008 次/千字",
        "advice": "删掉起手式，直接给判断。",
    },
    {
        "id": "when_clause",
        "level": "A",
        "name": "「当…时」前置从句",
        "pattern": r"当[^，。\n]{2,20}(?<!的时候)时，",
        "reference": "—",
        "advice": "删「当」和「时」，让从句直接作前一分句；删掉会模糊时点关系的保留。",
    },
    {
        "id": "topic_shell",
        "level": "A",
        "name": "前置话题壳",
        "pattern": (
            r"(?:对于[^，。\n]{2,15}来说|对[^，。\n]{2,15}而言"
            r"|就[^，。\n]{2,15}而言|在[^，。\n]{2,12}方面)"
        ),
        "reference": "—",
        "advice": "对象直接放到主语位，删掉壳子。",
    },
    {
        "id": "initial_connector",
        "level": "A",
        "name": "句首连接词",
        "pattern": r"(?:^|(?<=[。！？\n]))\s{0,3}(?:然而|因此|此外|与此同时|换言之|总而言之)[，、]",
        "reference": "—",
        "advice": "移到主语后，或换成「不过」「其实」；论证确实需要显式路标时保留。",
    },
    {
        "id": "enumeration",
        "level": "B",
        "name": "顿号并列过密",
        "pattern": r"[^，。！？；：、\n]{1,14}、[^，。！？；：、\n]{1,14}、[^，。！？；：、\n]{1,14}",
        "reference": "1.78 次/千字",
        "advice": "能概括就概括；必须保留时改变其中一项的句法，不让它们排成同一结构。",
    },
    {
        "id": "long_premodifier",
        "level": "B",
        "name": "过长前置定语",
        "pattern": r"(?:一个|一种|一套|这种|这个)[^，。、；：！？\n]{15,}的[\u4e00-\u9fff]{2,5}",
        "reference": "约 0.1 次/千字",
        "advice": "拆成两个分句；「的」字连续两个以上按同一方式处理。",
    },
    {
        "id": "ordinal_heading",
        "level": "X",
        "name": "序数词小标题",
        "pattern": r"^\s{0,3}#{1,6}\s{0,3}[一二三四五六七八九十][、.]",
        "reference": "—",
        "advice": "实测人类更常用，不是 AI 味，不改。",
    },
    {
        "id": "means_restate",
        "level": "X",
        "name": "「这意味着」复述",
        "pattern": r"(?:这意味着|这表明|这说明)",
        "reference": "—",
        "advice": "配对复测人类更多，不改。",
    },
    {
        "id": "empty_colon_list",
        "level": "X",
        "name": "空转提示冒号",
        "pattern": r"[^，。！？\n]{0,25}[：:]\s*$",
        "reference": "—",
        "advice": "目录式长文的正常写法，不改。",
    },
    {
        "id": "vague_words",
        "level": "X",
        "name": "空泛程度词",
        "pattern": (
            r"(?:显著(?:提升|提高|增长|改善|增加|优势)"
            r"|大幅(?:提升|增长|提高|改善|下降|减少)"
            r"|明显(?:改善|提升|优势|变化)|效率的提升|众多|海量)"
        ),
        "reference": "—",
        "advice": "没有稳定的人机差异，不改；事实与数字由信息守恒原则保护。",
    },
    {
        "id": "anthropomorphic",
        "level": "H",
        "name": "拟人化喻体",
        "pattern": (
            r"(?:像|如同|好比|犹如|相当于)[^，。！？\n]{0,6}一[位名个][^，。！？\n]{0,14}"
            r"(?:导师|秘书|助手|顾问|管家|审查员|实习生|军师|教练|伙伴|专家|舵手|灯塔)"
        ),
        "reference": "—",
        "advice": "贴切度机器判不准，默认保留；需要处理时由人工决定。",
    },
]

_SYNONYM_GROUPS = [
    ("使用", "采用", "运用", "利用", "借助"),
    ("方法", "方式", "途径", "路径", "做法"),
    ("提升", "提高", "增强", "强化", "优化"),
    ("显示", "表明", "揭示", "反映", "说明"),
    ("重要", "关键", "核心", "至关重要"),
    ("问题", "难题", "挑战", "困境", "痛点"),
    ("帮助", "协助", "助力", "支持"),
]

_STRUCTURE_REFS = {
    "sentence_cv": {
        "label": "句长离散度",
        "reference": "人类中位 0.54",
        "threshold": 0.55,
        "direction": "low",
        "note": "偏低表示句长偏均匀；只提示，不逐句改。",
    },
    "section_cv": {
        "label": "小节长度离散度",
        "reference": "人类中位 0.83",
        "threshold": 0.45,
        "direction": "low",
        "note": "偏低表示小节长度整齐；结构级提示，默认不改。",
    },
    "headings_per_1k": {
        "label": "小标题密度",
        "reference": "人类中位 0.32 / 千字",
        "threshold": 0.50,
        "direction": "high",
        "note": "偏高表示切得偏碎；结构级提示，默认不改。",
    },
    "iso2_per_100": {
        "label": "相邻两句同构",
        "reference": "人类 5.52 / 百段",
        "threshold": 8.0,
        "direction": "high",
        "note": "偏高表示相邻句骨架复用；需整段判断，不逐句改。",
    },
    "iso3_per_100": {
        "label": "三句同构",
        "reference": "人类 0.41 / 百段",
        "threshold": 0.8,
        "direction": "high",
        "note": "偏高表示连续三句骨架复用；改写时只拆一句。",
    },
    "mtld": {
        "label": "词汇多样性粗估",
        "reference": "人类中位约 143",
        "threshold": 200.0,
        "direction": "high",
        "note": "偏高表示同义换词多、不敢重复；粗估，仅供参考。",
    },
}

_PUNCTUATION_ITEMS = [
    ("dash", "破折号", "——", 0.83, 2.0, "密度超过 2 / 千字时优先检查；能直说就直说。"),
    ("semicolon", "分号", "；", 0.77, 1.5, "连续分号让一句承载过多层次时，优先考虑拆句。"),
    ("quote", "引号", "“", 20.0, None, "引号偏少不必然是问题，不据此增删。"),
    ("enumeration_comma", "顿号", "、", 6.12, 8.24, "句内并列过密时，参考「顿号并列过密」项。"),
    ("colon", "冒号", "：", 3.59, None, "冒号总量人类反而更多；只有「结论提示冒号」是改写信号。"),
]

_SEMANTIC_LABELS = {
    "rename": "同义重命名",
    "cohesion": "衔接连环",
    "colon": "结论提示冒号",
    "iso3": "高度同构三连",
}


def _hanzi_count(text: str) -> int:
    return len(_HANZI_RE.findall(text))


def _paragraph_blocks(text: str) -> List[Dict[str, Any]]:
    """按空行切段；没有空行时按单行切段。"""
    blocks: List[Dict[str, Any]] = []
    current: List[str] = []
    start: Optional[int] = None

    for line_no, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            if current:
                blocks.append(
                    {
                        "text": "\n".join(current),
                        "line": start or line_no,
                        "heading": bool(
                            _HEADING_RE.match(current[0])
                            or _BOLD_HEADING_RE.match(current[0])
                        ),
                    }
                )
                current = []
                start = None
            continue
        if not current:
            start = line_no
        current.append(line)

    if current:
        blocks.append(
            {
                "text": "\n".join(current),
                "line": start or 1,
                "heading": bool(
                    _HEADING_RE.match(current[0]) or _BOLD_HEADING_RE.match(current[0])
                ),
            }
        )

    non_empty_lines = [line for line in text.splitlines() if line.strip()]
    if len(blocks) <= 1 and len(non_empty_lines) > 1:
        blocks = [
            {"text": line.strip(), "line": line_no, "heading": bool(_HEADING_RE.match(line))}
            for line_no, line in enumerate(text.splitlines(), 1)
            if line.strip()
        ]
    return blocks


def _sentences(text: str) -> List[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(text) if len(s.strip()) >= 4]


def _signature(sentence: str) -> tuple:
    return (
        sentence.count("，"),
        "：" in sentence or ":" in sentence,
        "（" in sentence or "(" in sentence,
        len(sentence) // 15,
    )


def _isomorphic_count(sentences: List[str], n: int) -> int:
    count = 0
    for i in range(len(sentences) - n + 1):
        signatures = [_signature(s) for s in sentences[i : i + n]]
        if all(sig == signatures[0] for sig in signatures) and signatures[0][0] >= 1:
            count += 1
    return count


def _cv(values: List[float]) -> Optional[float]:
    if len(values) < 2:
        return None
    mean = sum(values) / len(values)
    if mean == 0:
        return None
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return (variance**0.5) / mean


def _mtld(tokens: List[str], threshold: float = 0.72, min_len: int = 10) -> Optional[int]:
    """中文无分词，用二字组作伪词粗估词汇多样性。"""
    if len(tokens) < min_len * 4:
        return None

    def pass_factors(sequence: List[str]) -> float:
        factors = 0.0
        types: set = set()
        count = 0
        for token in sequence:
            count += 1
            types.add(token)
            if count >= min_len and len(types) / count <= threshold:
                factors += 1
                types = set()
                count = 0
        if count:
            factors += (1 - len(types) / count) / (1 - threshold)
        return max(factors, 1e-9)

    forward = pass_factors(tokens)
    backward = pass_factors(list(reversed(tokens)))
    return round(len(tokens) / 2 * (1 / forward + 1 / backward))


def _structure_status(
    key: str,
    value: Optional[float],
    threshold: float,
    direction: str,
    hanzi: int,
    prose_count: int,
) -> str:
    if value is None:
        return "unknown"
    # 短文本的分布指标不稳定，只展示数值，不判定偏离
    if key == "mtld" and hanzi < 500:
        return "unknown"
    if key in {"iso2_per_100", "iso3_per_100"} and prose_count < 5:
        return "unknown"
    if key == "headings_per_1k" and hanzi < 300:
        return "unknown"
    if direction == "low" and value < threshold:
        return "low"
    if direction == "high" and value > threshold:
        return "high"
    return "ok"


def _collect_hits(text: str, pattern: str) -> List[Dict[str, Any]]:
    regex = re.compile(pattern, re.MULTILINE)
    hits: List[Dict[str, Any]] = []
    for match in regex.finditer(text):
        line = text.count("\n", 0, match.start()) + 1
        excerpt = match.group(0).strip().replace("\n", " ")
        hits.append({"line": line, "excerpt": excerpt[:80]})
    return hits


def validate_text(text: str) -> str:
    normalized = (text or "").replace("\r\n", "\n").strip()
    if len(normalized) < MIN_TEXT_CHARS or _hanzi_count(normalized) < MIN_HANZI:
        raise ValueError(f"文本太短，请至少输入 {MIN_HANZI} 个汉字。")
    if len(normalized) > MAX_TEXT_CHARS:
        raise ValueError(f"单次最多检测 {MAX_TEXT_CHARS} 字，请分段处理。")
    return normalized


def analyze_text(text: str, *, strict: bool = True) -> Dict[str, Any]:
    """运行确定性检测，返回分级报告。

    strict=False 用于改写后的回测：改写稿可能短于输入下限，此时只做检测，
    不再用输入下限拒绝结果。
    """
    normalized = (
        validate_text(text)
        if strict
        else (text or "").replace("\r\n", "\n").strip()
    )
    blocks = _paragraph_blocks(normalized)
    prose_blocks = [block for block in blocks if not block["heading"]]
    heading_count = sum(1 for block in blocks if block["heading"])

    sentences: List[str] = []
    sentence_lengths: List[float] = []
    iso2 = 0
    iso3 = 0
    bigrams: List[str] = []
    section_lengths: List[float] = []
    section_chars = 0.0

    for block in blocks:
        if block["heading"]:
            if section_chars > 0:
                section_lengths.append(section_chars)
            section_chars = 0.0
            continue
        block_sentences = _sentences(block["text"])
        sentences.extend(block_sentences)
        sentence_lengths.extend(
            float(_hanzi_count(sentence) or len(sentence)) for sentence in block_sentences
        )
        iso2 += _isomorphic_count(block_sentences, 2)
        iso3 += _isomorphic_count(block_sentences, 3)
        section_chars += len(block["text"])
        bigrams.extend(
            block["text"][i : i + 2]
            for i in range(len(block["text"]) - 1)
            if _HANZI_RE.match(block["text"][i : i + 2])
            and len(_HANZI_RE.findall(block["text"][i : i + 2])) == 2
        )

    if section_chars > 0:
        section_lengths.append(section_chars)

    hanzi = _hanzi_count(normalized)
    kk = max(hanzi / 1000, 0.001)
    prose_count = len(prose_blocks)

    groups: Dict[str, List[Dict[str, Any]]] = {"A": [], "B": [], "X": [], "H": []}
    for rule in _TEXT_RULES:
        hits = _collect_hits(normalized, rule["pattern"])
        if not hits:
            continue
        groups[rule["level"]].append(
            {
                "id": rule["id"],
                "name": rule["name"],
                "count": len(hits),
                "density": round(len(hits) / kk, 3),
                "reference": rule["reference"],
                "advice": rule["advice"],
                "examples": hits[:MAX_EXAMPLES_PER_RULE],
            }
        )

    synonym_hits: List[Dict[str, Any]] = []
    for block in prose_blocks:
        for group in _SYNONYM_GROUPS:
            found = [word for word in group if word in block["text"]]
            if len(found) >= 2:
                synonym_hits.append(
                    {
                        "line": block["line"],
                        "excerpt": "／".join(found),
                        "context": block["text"][:70],
                    }
                )
    if synonym_hits:
        groups["B"].append(
            {
                "id": "synonym_rotation",
                "name": "同义词轮换",
                "count": len(synonym_hits),
                "density": round(len(synonym_hits) / kk, 3),
                "reference": "启发式检测",
                "advice": "同一概念统一回原词；先确认确实指同一对象，避免误改近义词。",
                "examples": [
                    {"line": item["line"], "excerpt": item["excerpt"]}
                    for item in synonym_hits[:MAX_EXAMPLES_PER_RULE]
                ],
            }
        )

    structure: List[Dict[str, Any]] = []
    structure_values = {
        "sentence_cv": _cv(sentence_lengths),
        "section_cv": _cv(section_lengths) if len(section_lengths) >= 3 else None,
        "headings_per_1k": heading_count / kk,
        "iso2_per_100": (iso2 / prose_count * 100) if prose_count else None,
        "iso3_per_100": (iso3 / prose_count * 100) if prose_count else None,
        "mtld": _mtld(bigrams),
    }
    for key, meta in _STRUCTURE_REFS.items():
        value = structure_values.get(key)
        rounded = round(value, 3) if isinstance(value, float) else value
        structure.append(
            {
                "key": key,
                "label": meta["label"],
                "value": rounded,
                "reference": meta["reference"],
                "status": _structure_status(
                    key, value, meta["threshold"], meta["direction"], hanzi, prose_count
                ),
                "note": meta["note"],
            }
        )

    fingerprints: List[Dict[str, Any]] = []
    for key, label, char, human_ref, priority, note in _PUNCTUATION_ITEMS:
        count = normalized.count(char)
        density = count / kk
        if priority is None or hanzi < 500:
            status = "info"
        else:
            status = "high" if density > priority else "ok"
        fingerprints.append(
            {
                "key": key,
                "label": label,
                "count": count,
                "density": round(density, 3),
                "reference": f"人类中位 {human_ref} / 千字",
                "status": status,
                "note": note,
            }
        )

    actionable = sum(item["count"] for item in groups["A"] + groups["B"])
    actionable += sum(1 for item in fingerprints if item["status"] == "high")
    structure_flags = sum(1 for item in structure if item["status"] in {"low", "high"})
    keep_count = sum(item["count"] for item in groups["X"] + groups["H"])

    return {
        "meta": {
            "chars": len(normalized),
            "hanzi": hanzi,
            "paragraphs": prose_count,
            "headings": heading_count,
            "sentences": len(sentences),
        },
        "summary": {
            "actionable": actionable,
            "structure_flags": structure_flags,
            "keep": keep_count,
        },
        "groups": [
            {
                "level": level,
                "title": LEVEL_TITLES[level],
                "items": groups.get(level, []),
            }
            for level in ("A", "B")
        ],
        "fingerprints": fingerprints,
        "structure": structure,
        "keep": [
            {
                "level": level,
                "title": LEVEL_TITLES[level],
                "items": groups.get(level, []),
            }
            for level in ("X", "H")
        ],
        "limits": {"max_chars": MAX_TEXT_CHARS, "min_hanzi": MIN_HANZI},
    }


def summarize_actionable(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """把检测结果压缩为可执行的体检摘要（只保留 A/B 规则与高密度标点）。

    供报告润色等场景复用：不需要展示完整检测报告，只需要「改哪里、改几处」。
    """
    items: List[Dict[str, Any]] = []
    total = 0
    for group in analysis.get("groups", []):
        for item in group.get("items", []):
            total += int(item.get("count") or 0)
            items.append(
                {
                    "id": item["id"],
                    "level": group["level"],
                    "name": item["name"],
                    "count": item["count"],
                    "advice": item["advice"],
                    "examples": [
                        example["excerpt"] for example in item.get("examples", [])[:3]
                    ],
                }
            )

    fingerprints = [
        {
            "key": item["key"],
            "label": item["label"],
            "density": item["density"],
            "note": item["note"],
        }
        for item in analysis.get("fingerprints", [])
        if item.get("status") == "high"
    ]

    return {
        "actionable": total + len(fingerprints),
        "kinds": len(items) + len(fingerprints),
        "items": items,
        "fingerprints": fingerprints,
        "structure_flags": int(analysis.get("summary", {}).get("structure_flags") or 0),
    }


def _build_rewrite_prompt(text: str, analysis: Dict[str, Any]) -> str:
    lines = [
        "你是严谨的中文写作编辑。按待处理清单对文本做最小改动，降低机械化的 AI 写作痕迹。",
        "",
        "硬性要求：",
        "1. 只改清单命中的位置和同类语义问题，不顺便润色，不改没有问题的词。",
        "2. 信息守恒：姓名、数字、日期、引语、来源、因果和「可能/通常」等限定词必须保留。",
        "3. 结构不动：段落顺序、标题层级、列表、表格、引用、代码块位置原样保留。",
        "4. 不制造参差：不要为了「像人写」把句子改得忽长忽短，也不拆段。",
        "5. 不删问句、设问、比喻、序数词小标题；不改「这意味着」复述和空转冒号列表。",
        "6. 保持原文的正式语体，不强行加入「我/你」。",
        "",
        "语义复核（只按下面四类判断，最多列出 5 条；没有就不列）：",
        "- rename 同义重命名：同一实体或概念在一段内换实义说法，读者需要做「X 就是 Y」的连接。",
        "- cohesion 衔接连环：连续 6 个以上段间接口都是明确承接，几乎没有话题跳转。",
        "- colon 结论提示冒号：冒号前是独立的结论性判断，冒号后展开论证。",
        "- iso3 高度同构三连：连续三句的主谓宾和补充成分位置几乎一一对应。",
        "",
        "待处理清单：",
    ]

    for group in analysis["groups"]:
        for item in group["items"]:
            lines.append(
                f"- [{group['level']}] {item['name']}：{item['count']} 处；{item['advice']}"
            )
            for example in item["examples"][:3]:
                lines.append(f"  例：第 {example['line']} 行「{example['excerpt']}」")

    for item in analysis["fingerprints"]:
        if item["status"] == "high":
            lines.append(
                f"- [F] {item['label']}：{item['density']}/千字；{item['note']}"
            )

    lines.extend(
        [
            "",
            "原文：",
            wrap_user_input(text, label="article_text"),
            "",
            "只输出 JSON，不要 Markdown 代码块，不要解释：",
            '{"semantic_issues":[{"type":"rename|cohesion|colon|iso3",'
            '"excerpt":"原文片段","reason":"一句话理由"}],'
            '"changes":[{"before":"原文片段","after":"改后片段","rule":"对应规则"}],'
            '"rewritten_text":"完整改写稿"}',
        ]
    )
    return f"{build_prompt_injection_guard()}\n\n" + "\n".join(lines)


def _normalize_semantic_issues(raw: Any) -> List[Dict[str, str]]:
    if not isinstance(raw, list):
        return []
    issues: List[Dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        issue_type = str(item.get("type") or "").strip()
        if issue_type not in _SEMANTIC_LABELS:
            continue
        excerpt = str(item.get("excerpt") or "").strip()
        reason = str(item.get("reason") or "").strip()
        if not excerpt:
            continue
        issues.append(
            {
                "type": issue_type,
                "label": _SEMANTIC_LABELS[issue_type],
                "excerpt": excerpt[:120],
                "reason": reason[:160],
            }
        )
        if len(issues) >= MAX_SEMANTIC_ISSUES:
            break
    return issues


def _normalize_changes(raw: Any) -> List[Dict[str, str]]:
    if not isinstance(raw, list):
        return []
    changes: List[Dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        before = str(item.get("before") or "").strip()
        after = str(item.get("after") or "").strip()
        rule = str(item.get("rule") or "").strip()
        if not before or not after:
            continue
        changes.append(
            {"before": before[:160], "after": after[:160], "rule": rule[:60]}
        )
        if len(changes) >= MAX_CHANGES:
            break
    return changes


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```[a-zA-Z]*\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return stripped.strip()


def validate_rewrite_text(original: str, rewritten: str) -> None:
    """校验改写稿保留原文事实：改动、长度、数字、引语。"""
    if rewritten == original:
        raise ValueError("模型未产生有效改动，请重试。")

    ratio = len(rewritten) / max(len(original), 1)
    if ratio < 0.6 or ratio > 1.5:
        raise ValueError("改写幅度异常，已拒绝本次结果，请重试。")

    missing_numbers = [
        number for number in _NUMBER_RE.findall(original) if number not in rewritten
    ]
    if missing_numbers:
        raise ValueError(
            "改写结果未保留原文数字（" + "、".join(missing_numbers[:5]) + "），已拒绝本次结果。"
        )

    missing_quotes = [
        quote for quote in _QUOTE_RE.findall(original) if quote not in rewritten
    ]
    if missing_quotes:
        raise ValueError("改写结果未保留原文引语，已拒绝本次结果。")


def rewrite_text(text: str) -> Dict[str, Any]:
    """按检测清单做最小改写，并回测改写后指标。"""
    normalized = validate_text(text)
    before = analyze_text(normalized)
    prompt = _build_rewrite_prompt(normalized, before)

    try:
        raw = chat_pro(
            prompt,
            system="你是严谨的中文编辑。只输出符合要求的 JSON，不输出其他内容。",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("文字体检改写 LLM 调用失败: %s", exc, exc_info=True)
        raise ValueError("改写服务暂不可用，请稍后重试。") from exc

    try:
        payload = parse_llm_json_response(raw)
    except ValueError as exc:
        logger.warning("文字体检改写结果解析失败: %s", raw[:200])
        raise ValueError("改写结果解析失败，请重试。") from exc

    rewritten = _strip_code_fence(str(payload.get("rewritten_text") or ""))
    if not rewritten:
        raise ValueError("改写结果为空，请重试。")

    validate_rewrite_text(normalized, rewritten)
    after = analyze_text(rewritten, strict=False)

    return {
        "text": rewritten,
        "semantic_issues": _normalize_semantic_issues(payload.get("semantic_issues")),
        "changes": _normalize_changes(payload.get("changes")),
        "before": before,
        "after": after,
        "disclaimer": DISCLAIMER,
    }
