import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 微信 Native 下单（BFF 层）。
 * POST 转发到后端 /api/v1/payment/wxpay/{orderId}/qr → 返回 code_url。
 */

export async function POST(
  _request: Request,
  { params }: { params: { orderId: string } }
) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/payment/wxpay/${params.orderId}/qr`,
    {
      method: "POST",
      headers: {
        ...getBackendHeaders(_request),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { code: res.status * 100, message: `后端错误: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  return NextResponse.json(json);
}