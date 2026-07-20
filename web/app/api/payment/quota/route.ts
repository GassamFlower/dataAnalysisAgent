import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 用量额度（BFF 层）。
 * GET 转发到后端 /api/v1/payment/quota。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  const res = await fetch(`${BACKEND_URL}/api/v1/payment/quota`, {
    headers: getBackendHeaders(request),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { code: res.status * 100, message: `后端错误: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  return NextResponse.json({ code: 0, message: "success", data: json.data ?? json });
}
