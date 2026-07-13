import { NextResponse } from "next/server";

/**
 * 报告导出 API（BFF 层）。
 * 前端传 projectId（params.id），后端 export 路由用 report_id；
 * 此处先 GET 拿 report.id，再调后端 /report/export/{report_id}，透传二进制流。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const DEV_TOKEN = process.env.DEV_TOKEN ?? "dev-token";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { format } = body;

  if (!["word", "excel"].includes(format)) {
    return NextResponse.json(
      { error: "不支持的导出格式" },
      { status: 400 }
    );
  }

  // 1. 先查 report.id（前端传 projectId，后端 export 路由用 report_id）
  const reportRes = await fetch(`${BACKEND_URL}/api/v1/report/${params.id}`, {
    headers: { Authorization: `Bearer ${DEV_TOKEN}` },
    cache: "no-store",
  });
  if (!reportRes.ok) {
    const text = await reportRes.text().catch(() => "");
    return NextResponse.json(
      { error: `查询报告失败: ${reportRes.status}`, detail: text },
      { status: reportRes.status }
    );
  }
  const reportJson = await reportRes.json();
  const reportId = reportJson?.data?.id;
  if (!reportId) {
    return NextResponse.json({ error: "未找到报告" }, { status: 404 });
  }

  // 2. 调后端导出
  const exportRes = await fetch(
    `${BACKEND_URL}/api/v1/report/export/${reportId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEV_TOKEN}`,
      },
      body: JSON.stringify({ format }),
      cache: "no-store",
    }
  );

  if (!exportRes.ok) {
    const text = await exportRes.text().catch(() => "");
    return NextResponse.json(
      { error: `导出失败: ${exportRes.status}`, detail: text },
      { status: exportRes.status }
    );
  }

  // 3. 透传二进制流 + Content-Type / Content-Disposition
  const blob = await exportRes.blob();
  const headers = new Headers();
  const contentType = exportRes.headers.get("content-type");
  const disposition = exportRes.headers.get("content-disposition");
  if (contentType) headers.set("Content-Type", contentType);
  if (disposition) headers.set("Content-Disposition", disposition);
  return new NextResponse(blob, { status: 200, headers });
}
