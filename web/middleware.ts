import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 路由保护中间件。
 * (app) 路由组需要登录，其他路由公开访问。
 *
 * TODO: 接入真实认证后启用路由保护。
 * 当前骨架阶段暂时放行所有请求。
 */
export function middleware(_request: NextRequest) {
  // 骨架阶段：暂时放行所有请求
  // 后续接入真实认证逻辑时，取消下方注释：
  //
  // const { pathname } = request.nextUrl;
  // if (pathname.startsWith("/projects") || pathname.startsWith("/settings")) {
  //   const isAuthenticated = request.cookies.get("auth-token");
  //   if (!isAuthenticated) {
  //     const loginUrl = new URL("/login", request.url);
  //     loginUrl.searchParams.set("redirect", pathname);
  //     return NextResponse.redirect(loginUrl);
  //   }
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了：
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
