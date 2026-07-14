import { NextResponse } from "next/server";

/**
 * 登录 BFF 路由。
 * 转发到后端 /api/v1/auth/dev-login，获取 JWT 返回前端。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST() {
  const res = await fetch(`${BACKEND_URL}/api/v1/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `登录失败: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  // 后端返回 {code, message, data: {token, user}}
  return NextResponse.json(json.data);
}
