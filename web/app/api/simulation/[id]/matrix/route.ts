import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 保存相关矩阵 API（BFF 层）。
 * 转发到后端 PUT /api/v1/simulation/{project_id}/matrix。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

interface MatrixCell {
  row: string;
  col: string;
  value: number;
  source: "user" | "system";
}

interface RequestBody {
  dimensions: string[];
  cells: MatrixCell[][];
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body: RequestBody = await request.json();

  if (!body.dimensions || !body.cells) {
    return NextResponse.json(
      { error: "参数错误：dimensions 和 cells 不能为空" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${BACKEND_URL}/api/v1/simulation/${params.id}/matrix`,
    {
      method: "PUT",
      headers: getBackendHeaders(request),
      body: JSON.stringify({
        dimensions: body.dimensions,
        cells: body.cells,
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `保存矩阵失败: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  const data = json.data ?? {};
  return NextResponse.json({
    code: 0,
    message: "success",
    data: {
      matrixId: data.matrix_id,
      projectId: data.project_id,
    },
  });
}
