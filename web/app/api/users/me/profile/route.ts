import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api/backend-url";
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookies";

export async function PATCH(request: Request) {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/v1/users/me/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  return NextResponse.json({ code: 0, message: "success", data: json.data });
}
