import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "auth-token";

/**
 * 路由保护中间件。
 * (app) 路由组（/projects、/settings）需要登录，其他路由公开访问。
 * 认证凭证优先读取 cookie，与 auth-store 的 setAuth/logout 保持同步。
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 受保护路由前缀
  const protectedPrefixes = ["/projects", "/settings"];
  const isProtected = protectedPrefixes.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

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
