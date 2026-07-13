import { NextResponse } from "next/server";

/**
 * 健康检查 API。
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "data-analysis-agent-web",
    timestamp: new Date().toISOString(),
  });
}
