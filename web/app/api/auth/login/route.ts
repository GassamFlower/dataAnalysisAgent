import { NextResponse } from "next/server";

import { createAuthResponse } from "../_utils";

/**
 * 登录 BFF 路由。
 * 转发到后端 /api/v1/auth/dev-login，获取双 token 返回前端。
 * 仅在开发环境（NODE_ENV !== "production"）暴露。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  if (!isDevelopment()) {
    return NextResponse.json(
      { code: 40400, message: "测试账号登录仅在开发环境可用" },
      { status: 404 }
    );
  }

  const res = await fetch(`${BACKEND_URL}/api/v1/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json(json, { status: res.status });
  }

  return createAuthResponse(json, request);
}
