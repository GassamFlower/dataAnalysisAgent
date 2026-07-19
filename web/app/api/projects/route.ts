import { NextResponse } from "next/server";
import type { Project } from "@/types";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 项目列表 API（BFF 层）。
 * 转发到后端 FastAPI /api/v1/projects，从请求头转发用户 JWT。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("page_size") ?? "20";

  const res = await fetch(
    `${BACKEND_URL}/api/v1/projects/?page=${page}&page_size=${pageSize}`,
    {
      headers: getBackendHeaders(request),
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
  const items = (json.data?.items ?? []).map((item: Record<string, unknown>) => ({
    id: item.id as string,
    name: item.name as string,
    status: item.status as Project["status"],
    createdAt: item.created_at as string,
    updatedAt: item.updated_at as string,
  }));
  return NextResponse.json({
    code: 0,
    message: "success",
    data: {
      projects: items,
      total: json.data?.total ?? 0,
      page: json.data?.page ?? 1,
      pageSize: json.data?.page_size ?? 20,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/v1/projects/`, {
    method: "POST",
    headers: {
      ...getBackendHeaders(request),
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
  const item = json.data ?? {};
  const project: Partial<Project> = {
    id: item.id,
    name: item.name,
    status: item.status,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
  return NextResponse.json(
    { code: 0, message: "success", data: project },
    { status: 201 }
  );
}
