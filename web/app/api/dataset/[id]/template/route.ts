import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 下载真实数据导入模板 API（BFF 层）。
 * 转发到后端 FastAPI /api/v1/dataset/{id}/template，透传二进制流。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const backendUrl = new URL(
    `${BACKEND_URL}/api/v1/dataset/${params.id}/template`
  );
  backendUrl.search = searchParams.toString();

  const res = await fetch(backendUrl.toString(), {
    headers: getBackendHeaders(request),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `后端错误: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const blob = await res.blob();
  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  const disposition = res.headers.get("content-disposition");
  if (contentType) headers.set("Content-Type", contentType);
  if (disposition) headers.set("Content-Disposition", disposition);
  return new NextResponse(blob, { status: 200, headers });
}
