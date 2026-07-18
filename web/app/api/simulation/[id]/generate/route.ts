import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 数据生成 API（BFF 层）。
 * 前端发送 { sampleSize }，BFF 转发到后端 POST /api/v1/simulation/{id}/generate。
 * 后端按 project_id 自动取最新 hypothesis 与 matrix，生成成功后返回 matrix。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = (await request.json()) as { sampleSize?: number };
  const sampleSize = body.sampleSize;

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

  return NextResponse.json({ matrix: matrixData });
}
