import { NextResponse } from "next/server";

/**
 * 题目体检 API（BFF 层）。
 * POST 转发到后端 /api/v1/questionnaire/inspect?project_id={id}。
 * 前端发送 {rawText}，后端期望 {text}，响应做 snake→camel 转换。
 *
 * 开发态用 dev-token 认证；生产态应从用户 session 取 token。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const DEV_TOKEN = process.env.DEV_TOKEN ?? "dev-token";

interface BackendQuestion {
  index: number;
  text: string;
  question_type: string;
  dimension: string;
  is_reverse: boolean;
  confidence: string;
}

interface BackendStructure {
  questions: BackendQuestion[];
  dimensions: string[];
  scale_type: string;
}

/** 后端 QuestionnaireStructure → 前端 {structure: QuestionnaireStructure} */
function transformStructure(raw: BackendStructure) {
  return {
    structure: {
      questions: raw.questions.map((q) => ({
        index: q.index,
        text: q.text,
        questionType: q.question_type,
        dimension: q.dimension,
        isReverse: q.is_reverse,
        confidence: q.confidence,
      })),
      dimensions: raw.dimensions,
      scaleType: raw.scale_type,
    },
  };
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { rawText } = body;

  if (!rawText || typeof rawText !== "string") {
    return NextResponse.json(
      { error: "参数错误：rawText 不能为空" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${BACKEND_URL}/api/v1/questionnaire/inspect?project_id=${params.id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEV_TOKEN}`,
      },
      body: JSON.stringify({ text: rawText }),
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
  // 后端返回 {code, message, data: QuestionnaireStructure}
  const structure = json.data as BackendStructure;
  return NextResponse.json(transformStructure(structure));
}
