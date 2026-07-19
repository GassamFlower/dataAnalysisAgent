import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 单个项目 API（BFF 层）。
 * GET 转发到后端 /api/v1/projects/{id}，做 snake→camel 转换。
 * DELETE 转发到后端 /api/v1/projects/{id}（返回 204）。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

interface BackendProject {
  id: string;
  user_id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

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
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${BACKEND_URL}/api/v1/projects/${params.id}`, {
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

  const json = await res.json();
  const project = transformProject(json.data as BackendProject);
  return NextResponse.json({ code: 0, message: "success", data: project });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/v1/projects/${params.id}`, {
    method: "PATCH",
    headers: {
      ...getBackendHeaders(request),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
  const project = transformProject(json.data as BackendProject);
  return NextResponse.json({ code: 0, message: "success", data: project });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${BACKEND_URL}/api/v1/projects/${params.id}`, {
    method: "DELETE",
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

  return NextResponse.json({ code: 0, message: "success", data: { success: true, id: params.id } });
}
