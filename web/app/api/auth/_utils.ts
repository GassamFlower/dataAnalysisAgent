import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "auth-token";
// access token 本身只有 15 分钟有效期，但 cookie 作为"已登录"标记随 refresh token 一起保留 7 天，
// 供 middleware 做路由保护；实际接口鉴权仍以后端校验 access token 为准。
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

const REFRESH_COOKIE_NAME = "refresh-token";
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

/**
 * 从后端登录响应中提取双 token，将 refresh token 写入 httpOnly cookie，
 * 并返回只含 accessToken + user 的 BFF 响应。
 *
 * 后端响应格式：{ code, message, data: { access_token, refresh_token, user } }
 * BFF 返回格式：{ code, message, data: { accessToken, user } }
 */
export function createAuthResponse(backendJson: {
  code: number;
  message: string;
  data?: {
    access_token?: string;
    refresh_token?: string;
    user?: unknown;
  };
}) {
  const { access_token, refresh_token, user } = backendJson.data ?? {};

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
      secure: process.env.NODE_ENV === "production",
    });
  }

  if (refresh_token) {
    response.cookies.set(REFRESH_COOKIE_NAME, refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }

  return response;
}

/** 清除 refresh token cookie（退出登录用） */
export function clearRefreshCookie(response: NextResponse): NextResponse {
  response.cookies.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

/** 清除 access token cookie（退出登录用） */
export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
