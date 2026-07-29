import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api/backend-url";
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookies";

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  const res = await fetch(`${BACKEND_URL}/api/v1/users/me`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await res.json();
  return NextResponse.json({ code: 0, message: "success", data: json.data });
}
