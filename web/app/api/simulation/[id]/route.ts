import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 模拟矩阵 API（BFF 层）。
 * GET 转发到后端 /api/v1/simulation/{project_id}，
 * 后端从已保存的假设路径重建相关矩阵。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

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
  return NextResponse.json({
    matrix,
    hypothesisText: data.hypothesis_text ?? null,
    paths,
  });
}
