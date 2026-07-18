import { NextResponse } from "next/server";

import { clearAuthCookie, clearRefreshCookie } from "../_utils";

/**
 * 退出登录 BFF 路由。
 * 通知后端清除 refresh token 哈希，并清除本地 auth-token / refresh-token cookie。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  // 将前端携带的 access token 透传给后端，用于定位当前用户并清空 refresh_token
  const authHeader = request.headers.get("authorization") ?? "";

  try {
    await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });
  } catch {
    // 后端清除失败不影响前端继续清理本地状态
  }

  const response = NextResponse.json({
    code: 0,
    message: "已退出登录",
    data: null,
  });

  clearAuthCookie(response);
  clearRefreshCookie(response);
  return response;
}
