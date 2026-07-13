import { NextResponse } from "next/server";

/**
 * 题目体检 API（BFF 层）。
 * GET 转发到后端 /api/v1/questionnaire/questions/{project_id}，
 * 将 List[QuestionResponse] 转换为前端期望的 {structure: QuestionnaireStructure}。
 *
 * 体检（POST）已移至 app/api/questionnaire/[id]/parse/route.ts。
 * 开发态用 dev-token 认证；生产态应从用户 session 取 token。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const DEV_TOKEN = process.env.DEV_TOKEN ?? "dev-token";

interface BackendQuestion {
  id: string;
  index: number;
  text: string;
  question_type: string;
  dimension: string;
  is_reverse: boolean;
  confidence: string;
}

/** 后端 List[QuestionResponse] → 前端 {structure: QuestionnaireStructure} */
function transformQuestions(questions: BackendQuestion[]) {
  // 从题目提取唯一维度列表（保持出现顺序）
  const dimensions: string[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
    if (q.dimension && !seen.has(q.dimension)) {
      seen.add(q.dimension);
      dimensions.push(q.dimension);
    }
  }

  // scaleType：取第一题的 question_type，兜底 "likert5"
  const scaleType =
    questions[0]?.question_type && questions[0].question_type.startsWith("likert")
      ? questions[0].question_type
      : "likert5";

  return {
    structure: {
      questions: questions.map((q) => ({
        index: q.index,
        text: q.text,
        questionType: q.question_type,
        dimension: q.dimension,
        isReverse: q.is_reverse,
        confidence: q.confidence,
      })),
      dimensions,
      scaleType,
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/questionnaire/questions/${params.id}`,
    {
      headers: { Authorization: `Bearer ${DEV_TOKEN}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `后端错误: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  // 后端返回 {code, message, data: List[QuestionResponse]}
  const questions = (json.data ?? []) as BackendQuestion[];
  return NextResponse.json(transformQuestions(questions));
}
