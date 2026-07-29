import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAuthResponse } from "../_utils";
import { BACKEND_URL } from "@/lib/api/backend-url";
import { REFRESH_COOKIE_NAME } from "@/lib/auth-cookies";

/**
 * 刷新 access token BFF 路由。
 * 读取 httpOnly refresh-token cookie 转发到后端，换发新的双 token。
 */

export async function POST(request: Request) {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { code: 40100, message: "登录已过期，请重新登录" },
      { status: 401 }
    );
  }

  const res = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json(json, { status: res.status });
  }

  return createAuthResponse(json, request);
}
