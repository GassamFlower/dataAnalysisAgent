import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 维度列表 / 维度编辑 BFF 路由。
 * GET  转发到后端 /api/v1/questionnaire/dimensions/{project_id}
 * POST 转发到后端 /api/v1/questionnaire/dimensions/{project_id}
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/questionnaire/dimensions/${params.id}`,
    {
      headers: getBackendHeaders(request),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `获取维度失败: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  const data = json.data ?? { dimensions: [] };
  return NextResponse.json({ code: 0, message: "success", data: { dimensions: data.dimensions ?? [] } });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { action, name, oldName } = body;

  if (!action || !name) {
    return NextResponse.json(
      { error: "参数错误：action 和 name 不能为空" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${BACKEND_URL}/api/v1/questionnaire/dimensions/${params.id}`,
    {
      method: "POST",
      headers: getBackendHeaders(request),
      body: JSON.stringify({
        action,
        name,
        old_name: oldName,
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `更新维度失败: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  const data = json.data ?? { dimensions: [] };
  return NextResponse.json({ code: 0, message: "success", data: { dimensions: data.dimensions ?? [] } });
}
