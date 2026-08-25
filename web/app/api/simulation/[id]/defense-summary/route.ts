import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 模拟答辩摘要 API（BFF 层）。
 * 前端 POST 无 body，BFF 转发到后端 POST /api/v1/simulation/{id}/defense-summary。
 * 后端按 project_id 聚合预演命中率并逐路径生成答辩问答，返回归一化的 camelCase 数据。
 */

/** 将后端 snake_case 答辩摘要归一化为前端 camelCase（DefenseSummary） */
function normalizeItem(p: Record<string, unknown>) {
  return {
    predictor: p.predictor,
    outcome: p.outcome,
    direction: p.direction,
    strength: p.strength,
    effectSizeR: p.effect_size_r,
    sampleSize: p.sample_size,
    hitRate: p.hit_rate,
    target: p.target,
    passed: p.passed,
    question: p.question,
    answer: p.answer,
  };
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const summaryRes = await fetch(
    `${BACKEND_URL}/api/v1/simulation/${params.id}/defense-summary`,
    {
      method: "POST",
      headers: getBackendHeaders(_request),
      cache: "no-store",
    }
  );

  if (!summaryRes.ok) {
    const text = await summaryRes.text().catch(() => "");
    return NextResponse.json(
      { error: `答辩摘要生成失败: ${summaryRes.status}`, detail: text },
      { status: summaryRes.status }
    );
  }

  let raw: Record<string, unknown> | null = null;
  try {
    const json = await summaryRes.json();
    raw = json?.data ?? null;
  } catch {
    raw = null;
  }

  if (!raw) {
    return NextResponse.json(
      { error: "答辩摘要生成失败", detail: "后端未返回数据" },
      { status: 502 }
    );
  }

  const items = Array.isArray(raw.items)
    ? (raw.items as Record<string, unknown>[]).map(normalizeItem)
    : [];

  return NextResponse.json({
    code: 0,
    message: "success",
    data: {
      projectId: raw.project_id,
      sampleSize: raw.sample_size,
      overall: raw.overall,
      passedCount: raw.passed_count,
      totalCount: raw.total_count,
      text: raw.text,
      disclaimer: raw.disclaimer,
      items,
    },
  });
}