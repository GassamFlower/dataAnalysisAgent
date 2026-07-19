import { NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

export async function GET() {
  const res = await apiClient.get("/api/v1/users/me");
  const json = await res.json();
  return NextResponse.json({ code: 0, message: "success", data: json.data });
}
