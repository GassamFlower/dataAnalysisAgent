import { NextResponse } from "next/server";

/**
 * 问卷文件上传 API（BFF 层）。
 * POST 透传到后端 /api/v1/questionnaire/upload?project_id={id}。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "参数错误：缺少文件" },
      { status: 400 }
    );
  }

  const backendForm = new FormData();
  backendForm.append("file", file, file.name);

  // 透传 Authorization，但不设置 Content-Type（让 fetch 自动生成 multipart boundary）
  const headers: Record<string, string> = {};
  const auth = request.headers.get("Authorization");
  if (auth) {
    headers["Authorization"] = auth;
  }

  const res = await fetch(
    `${BACKEND_URL}/api/v1/questionnaire/upload?project_id=${params.id}`,
    {
      method: "POST",
      headers,
      body: backendForm,
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `后端错误: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  return NextResponse.json(json.data ?? json);
}
