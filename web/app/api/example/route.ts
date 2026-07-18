import { NextResponse } from "next/server";

/**
 * 示例 API。
 * 返回 apiClient 统一格式：{ code, message, data }。
 */
export async function GET() {
  return NextResponse.json({
    code: 0,
    message: "ok",
    data: {
      status: "ok",
      service: "data-analysis-agent-web",
      timestamp: new Date().toISOString(),
    },
  });
}
