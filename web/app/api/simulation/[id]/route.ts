import { NextResponse } from "next/server";

/**
 * 模拟矩阵 API（BFF 层）。
 * GET 转发到后端 /api/v1/simulation/{project_id}，
 * 后端从已保存的假设路径重建相关矩阵（透明展示：用户假设 vs 系统补全）。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const DEV_TOKEN = process.env.DEV_TOKEN ?? "dev-token";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/simulation/${params.id}`,
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
  // 后端 {code,message,data:{dimensions,cells,hypothesis_text,paths}}
  // → 前端 {matrix:{dimensions,cells}, hypothesisText, paths}
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
