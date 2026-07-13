import { NextResponse } from "next/server";

/**
 * 数据集导出 BFF 路由。
 * 转发后端 POST /api/v1/simulation/export-data/{project_id}，
 * 透传 Excel 二进制流。
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const DEV_TOKEN = process.env.DEV_TOKEN ?? "dev-token";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const exportRes = await fetch(
    `${BACKEND_URL}/api/v1/simulation/export-data/${params.id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEV_TOKEN}`,
      },
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

  // 透传二进制流 + Content-Type / Content-Disposition
  const blob = await exportRes.blob();
  const headers = new Headers();
  const contentType = exportRes.headers.get("content-type");
  const disposition = exportRes.headers.get("content-disposition");
  if (contentType) headers.set("Content-Type", contentType);
  if (disposition) headers.set("Content-Disposition", disposition);
  return new NextResponse(blob, { status: 200, headers });
}
