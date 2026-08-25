import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 模拟矩阵 API（BFF 层）。
 * GET 转发到后端 /api/v1/simulation/{project_id}，
 * 后端从已保存的假设路径重建相关矩阵。
 */

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/simulation/${params.id}`,
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
  const data = json.data ?? { dimensions: [], cells: [], hypothesis_text: null, paths: [] };
  const matrix = {
    dimensions: data.dimensions ?? [],
    cells: data.cells ?? [],
  };
  const paths = (data.paths ?? []).map((p: Record<string, unknown>) => ({
    predictor: p.predictor as string,
    outcome: p.outcome as string,
    direction: p.direction as "positive" | "negative",
    strength: p.strength as "weak" | "medium" | "strong",
  }));

  // 把后端返回的命中率归一化为前端 camelCase（已生成过预演才返回）
  const hitRate = normalizeHitRate(data.hit_rate);

  return NextResponse.json({
    code: 0,
    message: "success",
    data: {
      matrix,
      hypothesisText: data.hypothesis_text ?? null,
      paths,
      ...(hitRate ? { hitRate } : {}),
    },
  });
}

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
