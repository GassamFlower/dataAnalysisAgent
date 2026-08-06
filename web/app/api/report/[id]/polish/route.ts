import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 报告文字润色 API（BFF 层）。
 * 转发到后端 POST /api/v1/report/polish/{report_id}，透传 JSON body。
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  const res = await fetch(
    `${BACKEND_URL}/api/v1/report/polish/${params.id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getBackendHeaders(request),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `润色失败: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  return NextResponse.json(json);
}
