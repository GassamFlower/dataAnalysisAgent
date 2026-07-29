import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 模拟数据承诺确认（BFF 层）。
 * POST 转发到后端 /api/v1/compliance/simulation-disclaimer/confirm。
 */

export async function POST(request: Request) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/compliance/simulation-disclaimer/confirm`,
    {
      method: "POST",
      headers: getBackendHeaders(request),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { code: res.status * 100, message: `后端错误: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  return NextResponse.json({ code: 0, message: "success", data: json.data });
}
