import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 题目体检 API（BFF 层）。
 * GET 转发到后端 /api/v1/questionnaire/questions/{project_id}。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

interface BackendQuestion {
  id: string;
  index: number;
  text: string;
  question_type: string;
  dimension: string;
  is_reverse: boolean;
  confidence: string;
}

function transformQuestions(questions: BackendQuestion[]) {
  const dimensions: string[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
    if (q.dimension && !seen.has(q.dimension)) {
      seen.add(q.dimension);
      dimensions.push(q.dimension);
    }
  }

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
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/questionnaire/questions/${params.id}`,
    {
      headers: getBackendHeaders(request),
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
  const questions = (json.data ?? []) as BackendQuestion[];
  return NextResponse.json(transformQuestions(questions));
}
