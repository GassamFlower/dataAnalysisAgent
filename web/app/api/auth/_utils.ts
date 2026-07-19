import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "auth-token";
// access token 本身只有 15 分钟有效期，但 cookie 作为"已登录"标记随 refresh token 一起保留 7 天，
// 供 middleware 做路由保护；实际接口鉴权仍以后端校验 access token 为准。
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

const REFRESH_COOKIE_NAME = "refresh-token";
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

/**
 * 判断当前请求是否通过 HTTPS 访问。
 * 优先读取 X-Forwarded-Proto（反向代理场景），否则使用请求 URL 的协议。
 * 生产环境若直接以 HTTP 访问，则不应设置 Secure cookie，否则浏览器会拒绝写入，
 * 导致刷新页面时 middleware 读不到 auth-token 而跳回登录页。
 */
export function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto === "https";
  }
  return new URL(request.url).protocol === "https:";
}

/**
 * 从后端登录响应中提取双 token，将 refresh token 写入 httpOnly cookie，
 * 并返回只含 accessToken + user 的 BFF 响应。
 *
 * 后端响应格式：{ code, message, data: { access_token, refresh_token, user } }
 * BFF 返回格式：{ code, message, data: { accessToken, user } }
 */
export function createAuthResponse(
  backendJson: {
    code: number;
    message: string;
    data?: {
      access_token?: string;
      refresh_token?: string;
      user?: unknown;
    };
  },
  request: Request
) {
  const { access_token, refresh_token, user } = backendJson.data ?? {};
  const secure = isSecureRequest(request);

  const response = NextResponse.json({
    code: backendJson.code,
    message: backendJson.message,
    data: {
      accessToken: access_token,
      user,
    },
  });

  if (access_token) {
    response.cookies.set(AUTH_COOKIE_NAME, access_token, {
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure,
    });
  }

  if (refresh_token) {
    response.cookies.set(REFRESH_COOKIE_NAME, refresh_token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }

  return response;
}

/** 清除 refresh token cookie（退出登录用） */
export function clearRefreshCookie(
  response: NextResponse,
  request: Request
): NextResponse {
  response.cookies.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

/** 清除 access token cookie（退出登录用） */
export function clearAuthCookie(
  response: NextResponse,
  request: Request
): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: isSecureRequest(request),
  });
  return response;
}
