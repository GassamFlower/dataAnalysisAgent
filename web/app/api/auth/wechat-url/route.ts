import { NextResponse } from "next/server";

/**
 * 微信登录 BFF：获取微信授权链接。
 * 前端登录页调用此路由，拿到 url 后跳转到微信授权页。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get("redirect") ?? "/projects";

  const res = await fetch(
    `${BACKEND_URL}/api/v1/auth/wechat/login-url?redirect=${encodeURIComponent(redirect)}`,
    { headers: { "Content-Type": "application/json" } }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `获取微信授权链接失败: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  // 后端返回 {code, message, data: {url}}
  return NextResponse.json(json.data);
}
