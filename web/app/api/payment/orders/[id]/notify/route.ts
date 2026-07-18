import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 支付回调（BFF 层）。
 * POST 转发到后端 /api/v1/payment/orders/{id}/notify。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  const res = await fetch(
    `${BACKEND_URL}/api/v1/payment/orders/${params.id}/notify`,
    {
      method: "POST",
      headers: {
        ...getBackendHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: body.channel,
        transaction_id: body.transactionId,
        status: body.status,
      }),
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
