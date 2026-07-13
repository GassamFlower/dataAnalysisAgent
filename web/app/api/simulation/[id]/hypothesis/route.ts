import { NextResponse } from "next/server";

/**
 * 假设解析 API（BFF 层）。
 * 转发到后端 POST /api/v1/simulation/hypothesis/{project_id}，
 * 后端调用 LLM 解析用户假设为主效应路径。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const DEV_TOKEN = process.env.DEV_TOKEN ?? "dev-token";

interface HypothesisPath {
  predictor: string;
  outcome: string;
  direction: "positive" | "negative";
  strength: "weak" | "medium" | "strong";
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const rawText = body.rawText ?? body.raw_text ?? "";

  if (!rawText) {
    return NextResponse.json(
      { error: "参数错误：rawText 不能为空" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${BACKEND_URL}/api/v1/simulation/hypothesis/${params.id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEV_TOKEN}`,
      },
      body: JSON.stringify({ raw_text: rawText }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `假设解析失败: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  // 后端 {code,message,data:{id,project_id,raw_text,paths:[{predictor,outcome,direction,strength}]}}
  // → 前端 {hypothesisId, paths}
  const data = json.data ?? {};
  const paths: HypothesisPath[] = (data.paths ?? []).map(
    (p: Record<string, unknown>) => ({
      predictor: p.predictor as string,
      outcome: p.outcome as string,
      direction: p.direction as "positive" | "negative",
      strength: p.strength as "weak" | "medium" | "strong",
    })
  );
  return NextResponse.json({
    hypothesisId: data.id,
    paths,
  });
}
