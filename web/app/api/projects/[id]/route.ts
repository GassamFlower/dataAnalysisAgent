import { NextResponse } from "next/server";

/**
 * 单个项目 API（BFF 层）。
 * GET 转发到后端 /api/v1/projects/{id}，做 snake→camel 转换。
 * DELETE 转发到后端 /api/v1/projects/{id}（返回 204）。
 * 开发态用 dev-token 认证；生产态应从用户 session 取 token。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const DEV_TOKEN = process.env.DEV_TOKEN ?? "dev-token";

interface BackendProject {
  id: string;
  user_id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/** 后端 ProjectResponse → 前端 Project（snake→camel，丢弃 user_id） */
function transformProject(raw: BackendProject) {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${BACKEND_URL}/api/v1/projects/${params.id}`, {
    headers: { Authorization: `Bearer ${DEV_TOKEN}` },
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
  // 后端返回 {code, message, data: ProjectResponse}
  const project = transformProject(json.data as BackendProject);
  return NextResponse.json(project);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${BACKEND_URL}/api/v1/projects/${params.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${DEV_TOKEN}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `后端错误: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  // 后端返回 204 No Content
  return NextResponse.json({ success: true, id: params.id });
}
