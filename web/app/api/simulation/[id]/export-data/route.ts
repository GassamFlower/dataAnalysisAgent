import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 数据集导出 BFF 路由。
 * 转发后端 POST /api/v1/simulation/{project_id}/export-data，透传二进制流。
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => ({ format: "excel" }));
  const { format = "excel" } = body;

  const exportRes = await fetch(
    `${BACKEND_URL}/api/v1/simulation/${params.id}/export-data`,
    {
      method: "POST",
      headers: {
        ...getBackendHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ format }),
      cache: "no-store",
    }
  );

  if (!exportRes.ok) {
    const text = await exportRes.text().catch(() => "");
    return NextResponse.json(
      { error: `导出数据集失败: ${exportRes.status}`, detail: text },
      { status: exportRes.status }
    );
  }

  const blob = await exportRes.blob();
  const headers = new Headers();
  const contentType = exportRes.headers.get("content-type");
  const disposition = exportRes.headers.get("content-disposition");
  if (contentType) headers.set("Content-Type", contentType);
  if (disposition) headers.set("Content-Disposition", disposition);
  return new NextResponse(blob, { status: 200, headers });
}
