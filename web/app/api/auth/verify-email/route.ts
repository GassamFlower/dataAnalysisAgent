import { NextResponse } from "next/server";

import { createAuthResponse } from "../_utils";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/v1/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json(json, { status: res.status });
  }

  return createAuthResponse(json, request);
}
