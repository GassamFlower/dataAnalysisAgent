import { NextResponse } from "next/server";
import { getAuthHeader } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 导入真实回收数据 API（BFF 层）。
 * 转发到后端 FastAPI /api/v1/dataset/{id}/import，透传 multipart/form-data。
 */

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const backendUrl = new URL(
    `${BACKEND_URL}/api/v1/dataset/${params.id}/import`
  );
  backendUrl.search = searchParams.toString();

  const headers: Record<string, string> = {};
  const auth = getAuthHeader(request);
  if (auth) {
    headers["Authorization"] = auth;
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
      { error: `后端错误: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  return NextResponse.json(json);
}
