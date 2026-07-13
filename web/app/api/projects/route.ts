import { NextResponse } from "next/server";
import type { Project } from "@/types";

/**
 * 项目列表 API（BFF 层）。
 * 转发到后端 FastAPI /api/v1/projects，开发态用 dev-token 认证。
 * 生产态应从用户 session 取 token 注入 Authorization。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const DEV_TOKEN = process.env.DEV_TOKEN ?? "dev-token";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("page_size") ?? "20";

  const res = await fetch(
    `${BACKEND_URL}/api/v1/projects/?page=${page}&page_size=${pageSize}`,
    {
      headers: { Authorization: `Bearer ${DEV_TOKEN}` },
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
  // 后端返回 {code,message,data:{items,total,page,page_size}}（snake_case）
  // 前端期望 {projects: Project[]}（camelCase）
  const items = (json.data?.items ?? []).map((item: Record<string, unknown>) => ({
    id: item.id as string,
    name: item.name as string,
    status: item.status as Project["status"],
    createdAt: item.created_at as string,
    updatedAt: item.updated_at as string,
  }));
  return NextResponse.json({ projects: items });
}

export async function POST(request: Request) {
  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/v1/projects/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEV_TOKEN}`,
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
  // 后端返回 snake_case，前端期望 camelCase
  const item = json.data ?? {};
  const project: Partial<Project> = {
    id: item.id,
    name: item.name,
    status: item.status,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
  return NextResponse.json(project, { status: 201 });
}
