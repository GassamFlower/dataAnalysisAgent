import { NextResponse } from "next/server";

import { bffFetch, createAuthResponse } from "../_utils";
import { BACKEND_URL } from "@/lib/api/backend-url";

export async function POST(request: Request) {
  const body = await request.json();

  let res: Response;
  try {
    res = await bffFetch(`${BACKEND_URL}/api/v1/auth/email-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // 后端不可达 / 超时：返回 504 让前端进入 onError 提示用户重试
    return NextResponse.json(
      { code: 50400, message: "登录服务暂不可用，请稍后重试" },
      { status: 504 }
    );
  }

  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json(json, { status: res.status });
  }

  return createAuthResponse(json, request);
}
