import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 问卷星导入 API（BFF 层）。
 * 转发到后端 POST /api/v1/questionnaire/wjx-import/{project_id}，透传 multipart/form-data。
 */

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const backendUrl = new URL(
    `${BACKEND_URL}/api/v1/questionnaire/wjx-import/${params.id}`
  );

  const headers: Record<string, string> = {};
  const auth = getBackendHeaders(request);
  if (auth) {
    Object.assign(headers, auth);
  }

  const formData = await request.formData();

  const res = await fetch(backendUrl.toString(), {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `导入失败: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  return NextResponse.json(json);
}