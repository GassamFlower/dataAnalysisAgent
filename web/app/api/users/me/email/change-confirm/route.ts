import { NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

export async function POST(request: Request) {
  const body = await request.json();
  const res = await apiClient.post("/api/v1/users/me/email/change-confirm", {
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return NextResponse.json({ code: 0, message: json.message || "success", data: json.data });
}
