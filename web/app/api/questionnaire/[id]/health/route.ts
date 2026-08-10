import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 问卷质量体检 API（BFF 层）。
 * GET 转发到后端 FastAPI /api/v1/questionnaire/{project_id}/health。
 */

interface BackendHealthItem {
  key: string;
  title: string;
  status: "pass" | "warn" | "fail";
  score: number;
  message: string;
  suggestion: string;
}

interface BackendHealth {
  total_questions: number;
  overall_score: number;
  grade: string;
  summary: string;
  items: BackendHealthItem[];
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/questionnaire/${params.id}/health`,
    {
      headers: getBackendHeaders(request),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { code: res.status * 100, message: `后端错误: ${res.status}`, detail: text, data: null },
      { status: res.status }
    );
  }

  const json = await res.json();
  const raw = json.data as BackendHealth;

  return NextResponse.json({
    code: 0,
    message: "ok",
    data: {
      totalQuestions: raw.total_questions,
      overallScore: raw.overall_score,
      grade: raw.grade,
      summary: raw.summary,
      items: (raw.items ?? []).map((it) => ({
        key: it.key,
        title: it.title,
        status: it.status,
        score: it.score,
        message: it.message,
        suggestion: it.suggestion,
      })),
    },
  });
}
