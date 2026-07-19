import { NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

export async function PATCH(request: Request) {
  const body = await request.json();
  const res = await apiClient.patch("/api/v1/users/me/profile", {
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return NextResponse.json({ code: 0, message: "success", data: json.data });
}
