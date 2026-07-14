import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 数据生成 API（BFF 层）。
 * 前端发送 {sampleSize, hypothesisText, paths}，BFF 组合三步调用：
 *   1. POST /api/v1/simulation/hypothesis/{id} 创建假设
 *   2. POST /api/v1/simulation/generate 生成数据
 *   3. GET /api/v1/simulation/{id} 重建矩阵
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

interface HypothesisPath {
  predictor: string;
  outcome: string;
  direction: "positive" | "negative";
  strength: "weak" | "medium" | "strong";
}

interface SimulationConfig {
  sampleSize: number;
  hypothesisText: string;
  paths: HypothesisPath[];
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = (await request.json()) as SimulationConfig;
  const { sampleSize, hypothesisText, paths } = body;

  if (!sampleSize || !paths || paths.length === 0) {
    return NextResponse.json(
      { error: "参数错误：sampleSize 和 paths 不能为空" },
      { status: 400 }
    );
  }

  if (!hypothesisText) {
    return NextResponse.json(
      { error: "参数错误：hypothesisText 不能为空" },
      { status: 400 }
    );
  }

  // 1. 创建假设
  const hypoRes = await fetch(
    `${BACKEND_URL}/api/v1/simulation/hypothesis/${params.id}`,
    {
      method: "POST",
      headers: getBackendHeaders(request),
      body: JSON.stringify({ raw_text: hypothesisText }),
      cache: "no-store",
    }
  );

  if (!hypoRes.ok) {
    const text = await hypoRes.text().catch(() => "");
    return NextResponse.json(
      { error: `创建假设失败: ${hypoRes.status}`, detail: text },
      { status: hypoRes.status }
    );
  }

  const hypoJson = await hypoRes.json();
  const hypothesisId = hypoJson.data?.id;
  if (!hypothesisId) {
    return NextResponse.json(
      { error: "创建假设失败：未返回 hypothesis_id" },
      { status: 500 }
    );
  }

  // 2. 生成数据
  const genRes = await fetch(`${BACKEND_URL}/api/v1/simulation/generate`, {
    method: "POST",
    headers: getBackendHeaders(request),
    body: JSON.stringify({
      sample_size: sampleSize,
      hypothesis_id: hypothesisId,
      matrix_id: null,
    }),
    cache: "no-store",
  });

  if (!genRes.ok) {
    const text = await genRes.text().catch(() => "");
    return NextResponse.json(
      { error: `数据生成失败: ${genRes.status}`, detail: text },
      { status: genRes.status }
    );
  }

  // 3. 重建矩阵
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
    matrix: matrixData,
    hypothesisId,
  });
}
