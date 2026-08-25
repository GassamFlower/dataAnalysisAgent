import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 数据生成 API（BFF 层）。
 * 前端发送 { sampleSize }，BFF 转发到后端 POST /api/v1/simulation/{id}/generate。
 * 后端按 project_id 自动取最新 hypothesis 与 matrix，生成成功后返回 matrix。
 */

/** 将后端 snake_case 命中率归一化为前端 camelCase（HitRateSummary） */
function normalizeHitRate(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const paths = Array.isArray(r.paths)
    ? (r.paths as Record<string, unknown>[]).map((p) => ({
        predictor: p.predictor,
        outcome: p.outcome,
        direction: p.direction,
        strength: p.strength,
        effectSizeR: p.effect_size_r,
        sampleSize: p.sample_size,
        hitRate: p.hit_rate,
        target: p.target,
        passed: p.passed,
      }))
    : [];
  return {
    overall: r.overall,
    passedCount: r.passed_count,
    totalCount: r.total_count,
    paths,
  };
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = (await request.json()) as { sampleSize?: number; sample_size?: number };
  const sampleSize = body.sampleSize ?? body.sample_size;

  if (!sampleSize || sampleSize <= 0) {
    return NextResponse.json(
      { error: "参数错误：sampleSize 必须大于 0" },
      { status: 400 }
    );
  }

  const genRes = await fetch(
    `${BACKEND_URL}/api/v1/simulation/${params.id}/generate`,
    {
      method: "POST",
      headers: getBackendHeaders(request),
      body: JSON.stringify({ sample_size: sampleSize }),
      cache: "no-store",
    }
  );

  if (!genRes.ok) {
    const text = await genRes.text().catch(() => "");
    return NextResponse.json(
      { error: `数据生成失败: ${genRes.status}`, detail: text },
      { status: genRes.status }
    );
  }

  // 透传后端返回的预演命中率（无则保持 null）并归一化为前端 camelCase
  let hitRate: Record<string, unknown> | null = null;
  try {
    const genJson = await genRes.json();
    hitRate = normalizeHitRate(genJson?.data?.hit_rate);
  } catch {
    hitRate = null;
  }

  // 刷新矩阵
  const matrixRes = await fetch(
    `${BACKEND_URL}/api/v1/simulation/${params.id}`,
    {
      headers: getBackendHeaders(request),
      cache: "no-store",
    }
  );

  let matrixData: { dimensions: string[]; cells: unknown[] } = {
    dimensions: [],
    cells: [],
  };
  if (matrixRes.ok) {
    const matrixJson = await matrixRes.json();
    const data = matrixJson.data ?? {};
    matrixData = {
      dimensions: data.dimensions ?? [],
      cells: data.cells ?? [],
    };
  }

  return NextResponse.json({
    code: 0,
    message: "success",
    data: {
      matrix: matrixData,
      ...(hitRate ? { hitRate } : {}),
    },
  });
}
