import { NextResponse } from "next/server";

/**
 * 微信授权回调 BFF 路由。
 * 微信授权后重定向到此路由，带 code 和 state 参数。
 * 此路由将 code POST 到后端 /api/v1/auth/wechat/callback 交换双 token，
 * 然后通过 HTML 页面将 access token 写入 localStorage/cookie 并跳转到 state 指定的前端路径。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const REFRESH_COOKIE_NAME = "refresh-token";
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "/projects";

  // 解码 state（后端做了 quote_plus 编码）
  const redirectPath = decodeURIComponent(state);

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=missing_code`, origin));
  }

  // 调用后端交换 JWT
  const backendRes = await fetch(`${BACKEND_URL}/api/v1/auth/wechat/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!backendRes.ok) {
    const text = await backendRes.text().catch(() => "");
    return NextResponse.redirect(
      new URL(`/login?error=callback_failed&detail=${encodeURIComponent(text)}`, origin)
    );
  }

  const json = await backendRes.json();
  // 后端返回 {code, message, data: {access_token, refresh_token, user}}
  const { access_token, refresh_token, user } = json.data;

  // access token：cookie 与 localStorage 双写
  // - cookie 供 middleware 做路由保护
  // - localStorage 供 auth-store 在客户端即时恢复状态

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>登录中...</title></head>
<body>
<p style="text-align:center;padding-top:40px;font-family:sans-serif;">登录成功，正在跳转...</p>
<script>
  try {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user: ${JSON.stringify(user)},
        accessToken: ${JSON.stringify(access_token)},
        isAuthenticated: true,
      },
      version: 0,
    }));
  } catch (e) {
    console.error('写入 localStorage 失败', e);
  }
  window.location.href = ${JSON.stringify(redirectPath)};
</script>
</body>
</html>`;

  const response = new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });

  response.cookies.set("auth-token", access_token, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  response.cookies.set(REFRESH_COOKIE_NAME, refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return response;
}
