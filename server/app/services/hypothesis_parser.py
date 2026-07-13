"""假设解析服务（V3）。

职责：
- 将用户一句话假设拆解为多条主效应路径
- 每条路径：自变量 → 因变量，方向（positive/negative），强度（weak/medium/strong）
- 输出 JSON 供后续数据生成使用
"""
import json
import re
from typing import List, Dict, Any

from app.services.llm.client import chat_v3
from app.schemas.simulation import HypothesisPath


def _build_prompt(raw_text: str, dimensions: List[str]) -> str:
    """构建 LLM 提示词。"""
    dimensions_text = ', '.join(dimensions) if dimensions else "未提供"
    
    prompt = f"""你是一个心理学研究专家。请将以下研究假设拆解为具体的主效应路径。

用户假设：
{raw_text}

问卷维度：
{dimensions_text}

任务要求：
1. 识别假设中的自变量（predictor）和因变量（outcome）
2. 判断每个路径的方向（positive 正相关 / negative 负相关）
3. 判断每个路径的强度（weak 弱 / medium 中等 / strong 强）
4. 自变量和因变量必须是问卷维度中的名称

请以 JSON 格式返回，结构如下：
{{
  "paths": [
    {{
      "predictor": "自变量维度名",
      "outcome": "因变量维度名",
      "direction": "positive",
      "strength": "medium"
    }}
  ]
}}

注意：
- predictor 和 outcome 必须是问卷维度中的名称
- direction 只能是：positive, negative
- strength 只能是：weak, medium, strong
- 如果假设涉及多个路径，请全部列出
- 如果维度信息不足，尽量从假设文本中推断
"""
    return prompt


def _parse_llm_response(response: str) -> List[HypothesisPath]:
    """解析 LLM 返回的 JSON。"""
    # 尝试提取 JSON
    json_match = re.search(r'\{[\s\S]*\}', response)
    if not json_match:
        raise ValueError("无法从 LLM 响应中提取 JSON")
    
    json_str = json_match.group(0)
    data = json.loads(json_str)
    
    paths = []
    for p in data.get('paths', []):
        paths.append(HypothesisPath(
            predictor=p['predictor'],
            outcome=p['outcome'],
            direction=p['direction'],
            strength=p['strength']
        ))
    
    return paths


def parse_hypothesis(raw_text: str, dimensions: List[str]) -> List[HypothesisPath]:
    """假设解析入口。

    Args:
        raw_text: 用户一句话假设。
        dimensions: 问卷维度列表（来自题目体检）。

    Returns:
        List[HypothesisPath]: 主效应路径列表。
    """
    if not raw_text.strip():
        raise ValueError("假设文本不能为空")
    
    # 1. 构建提示词
    prompt = _build_prompt(raw_text, dimensions)
    
    # 2. 调用 LLM
    response = chat_v3(prompt)
    
    # 3. 解析响应
    paths = _parse_llm_response(response)
    
    if not paths:
        raise ValueError("未能从假设中解析出任何路径")
    
    return paths
