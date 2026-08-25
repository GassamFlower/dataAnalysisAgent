"""题目体检服务。

职责：
- 题型识别（李克特5/7点、人口学、反向题）
- 维度归属推断（80% 用户上传纯题干，需 LLM 聚类到维度）
- 输出题目×维度对照表，标注【明确归属】vs【存疑待确认】

注：不含智能诊断（诊断在 stats 之后由 diagnoser 触发）。
"""
import re
from typing import List, Dict, Any

from app.services.llm.client import chat_flash
from app.services.llm.utils import (
    build_prompt_injection_guard,
    parse_llm_json_response,
    wrap_user_input,
)
from app.schemas.questionnaire import Question, QuestionnaireStructure


def _parse_questions_from_text(text: str) -> List[Dict[str, Any]]:
    """从文本中提取题目列表。
    
    支持格式：
    - 1. 题目内容
    - 1、题目内容
    - (1) 题目内容
    - Q1: 题目内容
    """
    questions = []
    lines = text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 匹配多种题号格式
        match = re.match(r'^(?:\d+[\.\、\)]|\(\d+\)|Q\d+[\:\：])\s*(.+)$', line)
        if match:
            questions.append({
                'text': match.group(1).strip(),
                'index': len(questions) + 1
            })
        elif re.match(r'^[A-Z]\.', line):
            # 跳过选项行（A. B. C. 等）
            continue
        else:
            # 可能是无序号的题目
            if len(line) > 5:  # 至少5个字符才算题目
                questions.append({
                    'text': line,
                    'index': len(questions) + 1
                })
    
    return questions


def _build_prompt(questions: List[Dict[str, Any]]) -> str:
    """构建 LLM 提示词。

    N1: 题目原文属不可信用户输入，使用 <user_input> 边界标记包裹，
    并附加 prompt injection 防御指令。
    """
    questions_text = '\n'.join([f"{q['index']}. {q['text']}" for q in questions])
    wrapped = wrap_user_input(questions_text, label="user_questions")

    prompt = f"""你是一个问卷分析专家。请分析以下问卷题目，完成以下任务：

1. 识别每道题的题型（likert5/likert7/demographic/other）
2. 推断每道题属于哪个维度
3. 识别反向题（如果有）
4. 判断维度归属的置信度（high/low）

{build_prompt_injection_guard()}

题目列表：
{wrapped}

请以 JSON 格式返回，结构如下：
{{
  "questions": [
    {{
      "index": 1,
      "text": "题目内容",
      "question_type": "likert5",
      "dimension": "维度名称",
      "is_reverse": false,
      "confidence": "high"
    }}
  ],
  "dimensions": ["维度1", "维度2"],
  "scale_type": "likert5"
}}

注意：
- question_type 只能是：likert5, likert7, demographic, other
- confidence 表示维度归属的置信度，high 表示明确归属，low 表示存疑待确认
- 如果题目明显是人口学问题（如性别、年龄），标记为 demographic
- 反向题通常是"我不..."、"我从不..."等否定表述
- scale_type 根据大多数题目的选项数量判断
"""
    return prompt


def _parse_llm_response(response: str) -> QuestionnaireStructure:
    """解析 LLM 返回的 JSON。

    N6: 使用 llm.utils 中的统一解析函数，避免重复实现。
    """
    data = parse_llm_json_response(response)

    questions = []
    for q in data.get('questions', []):
        questions.append(Question(
            index=q['index'],
            text=q['text'],
            question_type=q['question_type'],
            dimension=q['dimension'],
            is_reverse=q.get('is_reverse', False),
            confidence=q.get('confidence', 'high')
        ))

    return QuestionnaireStructure(
        questions=questions,
        dimensions=data.get('dimensions', []),
        scale_type=data.get('scale_type', 'likert5')
    )


def inspect(raw_text: str) -> QuestionnaireStructure:
    """题目体检入口。

    Args:
        raw_text: 用户上传的题目原文（Word 解析后 / 纯文本）。

    Returns:
        QuestionnaireStructure: 题目结构 + 维度归属表。
    """
    # 1. 解析题目
    questions = _parse_questions_from_text(raw_text)
    
    if not questions:
        raise ValueError("未能从文本中解析出题目")
    
    # 2. 构建提示词
    prompt = _build_prompt(questions)
    
    # 3. 调用 LLM
    response = chat_flash(prompt)
    
    # 4. 解析响应
    result = _parse_llm_response(response)
    
    return result
