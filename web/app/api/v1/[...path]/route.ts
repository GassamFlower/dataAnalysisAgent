import { NextRequest, NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * /api/v1/* 通用代理（BFF 兜底转发）。
 *
 * 业务模块的精确路由（/api/projects、/api/auth/* 等）优先命中；
 * 此 catch-all 仅接管未显式定义的路由（如教程 /api/v1/tutorial/*），
 * 将浏览器同源请求原样转发到后端 FastAPI。
 */

async function proxy(
  request: NextRequest,
  pathSegments: string[]
): Promise<NextResponse> {
  const target = `${BACKEND_URL}/api/v1/${pathSegments.join(
    "/"
  )}${request.nextUrl.search}`;

  const headers: Record<string, string> = {};
  const auth = request.headers.get("authorization");
  if (auth) headers["authorization"] = auth;
  const contentType = request.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const method = request.method;
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.text();

  let res: Response;
  try {
    res = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { code: 50400, message: "后端服务暂不可用，请稍后重试" },
      { status: 504 }
    );
  }

  const text = await res.text();
  const response = new NextResponse(text, { status: res.status });
  const ct = res.headers.get("content-type");
  if (ct) response.headers.set("content-type", ct);
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(request, params.path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(request, params.path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(request, params.path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(request, params.path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(request, params.path);
}
