import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get("auth-token")?.value;

  const res = await fetch(`${BACKEND_URL}/api/v1/users/me`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await res.json();
  return NextResponse.json({ code: 0, message: "success", data: json.data });
}
