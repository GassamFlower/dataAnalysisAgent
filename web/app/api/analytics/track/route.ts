import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * POST /api/analytics/track
 * 前端埋点事件转发到后端
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${BACKEND_URL}/api/v1/analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: "Track failed" },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    // 埋点失败不影响用户体验
    return NextResponse.json({ success: true });
  }
}
