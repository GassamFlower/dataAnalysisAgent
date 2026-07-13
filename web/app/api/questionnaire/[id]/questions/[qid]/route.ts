import { NextResponse } from "next/server";

/**
 * 更新单题（BFF 层）。
 * PATCH 转发到后端 /api/v1/questionnaire/questions/{project_id}/{question_index}。
 * 前端发 camelCase，转 snake_case 给后端；响应反向转换。
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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; qid: string } }
) {
  const body = await request.json();
  const { dimension, isReverse, confidence } = body ?? {};

  // 转 snake_case，仅包含传入字段
  const payload: Record<string, unknown> = {};
  if (dimension !== undefined) payload.dimension = dimension;
  if (isReverse !== undefined) payload.is_reverse = isReverse;
  if (confidence !== undefined) payload.confidence = confidence;

  const res = await fetch(
    `${BACKEND_URL}/api/v1/questionnaire/questions/${params.id}/${params.qid}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEV_TOKEN}`,
      },
      body: JSON.stringify(payload),
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
  const q = json.data as BackendQuestion;
  // snake → camel
  return NextResponse.json({
    data: {
      id: q.id,
      index: q.index,
      text: q.text,
      questionType: q.question_type,
      dimension: q.dimension,
      isReverse: q.is_reverse,
      confidence: q.confidence,
    },
  });
}
